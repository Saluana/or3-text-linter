import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { LinterPlugin } from './LinterPlugin';
import type { AILinterPluginConfig, AIResponse, Issue, FixFn } from '../types';

/**
 * Text segment with position mapping from plain text to ProseMirror positions
 */
export interface TextSegment {
    /** The text content of this segment */
    text: string;
    /** Start position in ProseMirror document */
    from: number;
    /** End position in ProseMirror document */
    to: number;
    /** Start offset in the extracted plain text */
    textOffset: number;
}

/**
 * Result of text extraction with position mapping
 */
export interface TextExtractionResult {
    /** Full plain text extracted from the document */
    fullText: string;
    /** Array of text segments with position mappings */
    segments: TextSegment[];
}

/**
 * Base class for AI-powered lint plugins.
 * Extends LinterPlugin to support async scanning with AI providers.
 *
 * Requirements: 13.1, 13.2
 */
export abstract class AILinterPlugin extends LinterPlugin {
    protected config: AILinterPluginConfig;

    constructor(doc: ProsemirrorNode, config: AILinterPluginConfig) {
        super(doc);
        this.config = config;
    }

    /**
     * Extract plain text from the document with position mapping.
     * Builds a map from text offsets to ProseMirror positions.
     *
     * Requirement 13.2: Extract text content from the document for analysis
     *
     * @returns Object with full text and segments array for position mapping
     */
    protected extractTextWithPositions(): TextExtractionResult {
        const segments: TextSegment[] = [];
        const textParts: string[] = [];
        let textOffset = 0;
        let addedNewlineForBlock = false;

        this.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                segments.push({
                    text: node.text,
                    from: pos,
                    to: pos + node.text.length,
                    textOffset,
                });
                textParts.push(node.text);
                textOffset += node.text.length;
                addedNewlineForBlock = false; // Reset flag after text node
            } else if (
                node.isBlock &&
                segments.length > 0 &&
                !addedNewlineForBlock
            ) {
                // Add newline for block boundaries to preserve structure
                // Only add once per block to avoid duplicate newlines
                textParts.push('\n');
                textOffset += 1;
                addedNewlineForBlock = true;
            }
            return true; // Continue traversing
        });

        return { fullText: textParts.join(''), segments };
    }

    /**
     * Find the nth occurrence of a text match in the document.
     *
     * @param textMatch - The text to find
     * @param segments - The text segments from extractTextWithPositions()
     * @param fullText - The full extracted text
     * @param occurrenceIndex - Which occurrence to find (0-indexed)
     * @returns Position object with from/to, or null if not found
     */
    protected findNthOccurrence(
        textMatch: string,
        segments: TextSegment[],
        fullText: string,
        occurrenceIndex: number
    ): { from: number; to: number } | null {
        let currentIndex = 0;
        let searchFrom = 0;

        while (currentIndex <= occurrenceIndex) {
            const position = this.findTextPosition(
                textMatch,
                segments,
                fullText,
                searchFrom
            );
            if (!position) {
                return null;
            }
            if (currentIndex === occurrenceIndex) {
                return position;
            }
            // Move past this occurrence
            const textIndex = fullText.indexOf(textMatch, searchFrom);
            searchFrom = textIndex + textMatch.length;
            currentIndex++;
        }
        return null;
    }

    /**
     * Find the ProseMirror position of a text match in the document.
     *
     * Requirement 15.2: Map text offsets to ProseMirror positions
     *
     * @param textMatch - The text to find in the document
     * @param segments - The text segments from extractTextWithPositions()
     * @param fullText - The full extracted text
     * @param startFromIndex - Optional index to start searching from (for finding subsequent occurrences)
     * @returns Position object with from/to, or null if not found
     */
    protected findTextPosition(
        textMatch: string,
        segments: TextSegment[],
        fullText: string,
        startFromIndex = 0
    ): { from: number; to: number } | null {
        // Validate inputs
        if (!textMatch || !segments || segments.length === 0 || !fullText) {
            return null;
        }

        // Find the text match in the full text, starting from the given index
        const textIndex = fullText.indexOf(textMatch, startFromIndex);
        if (textIndex === -1) {
            return null;
        }

        const textEndIndex = textIndex + textMatch.length;

        // Find which segment(s) contain this text
        let from: number | null = null;
        let to: number | null = null;

        for (const segment of segments) {
            const segmentStart = segment.textOffset;
            const segmentEnd = segment.textOffset + segment.text.length;

            // Check if the match starts in this segment
            if (
                from === null &&
                textIndex >= segmentStart &&
                textIndex < segmentEnd
            ) {
                const offsetInSegment = textIndex - segmentStart;
                from = segment.from + offsetInSegment;
            }

            // Check if the match ends in this segment
            if (
                from !== null &&
                textEndIndex > segmentStart &&
                textEndIndex <= segmentEnd
            ) {
                const offsetInSegment = textEndIndex - segmentStart;
                to = segment.from + offsetInSegment;
                break;
            }

            // If match spans multiple segments, track the end
            if (from !== null && textEndIndex > segmentEnd) {
                to = segment.to;
            }
        }

        if (from !== null && to !== null) {
            return { from, to };
        }

        return null;
    }

    /**
     * Create a fix function that replaces text with the given replacement.
     *
     * Requirement 15.3: Support creating fix functions from AI-provided replacement text
     *
     * @param replacement - The replacement text
     * @returns FixFn that replaces the issue range with the replacement
     */
    protected createTextFix(replacement: string): FixFn {
        return (view: EditorView, issue: Issue) => {
            const tr = view.state.tr
                .replaceWith(
                    issue.from,
                    issue.to,
                    view.state.schema.text(replacement)
                )
                .setMeta('linterFix', true); // Mark as linter fix to skip async re-run
            view.dispatch(tr);
        };
    }

    /**
     * Parse an AI response and record issues with correct document positions.
     * Handles malformed responses gracefully without crashing.
     *
     * Requirements: 13.3, 15.1, 15.4
     *
     * @param response - The AI response (may be malformed)
     * @param segments - Text segments from extractTextWithPositions()
     * @param fullText - Full extracted text
     */
    protected parseAIResponse(
        response: unknown,
        segments: TextSegment[],
        fullText: string
    ): void {
        try {
            // Validate response structure (Requirement 15.4)
            if (!response || typeof response !== 'object') {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(
                        '[Tiptap Linter] AI response is not an object:',
                        response
                    );
                }
                return;
            }

            const typed = response as Partial<AIResponse>;
            if (!Array.isArray(typed.issues)) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(
                        '[Tiptap Linter] AI response has no issues array:',
                        response
                    );
                }
                return;
            }

            if (process.env.NODE_ENV !== 'production') {
                console.log(
                    '[Tiptap Linter] Processing',
                    typed.issues.length,
                    'AI issues'
                );
            }

            // Track used occurrences for each textMatch when AI doesn't provide occurrenceIndex
            const usedOccurrences = new Map<string, number>();

            for (const issue of typed.issues) {
                // Skip malformed issues
                if (!issue || typeof issue !== 'object') {
                    continue;
                }
                if (!issue.message || typeof issue.message !== 'string') {
                    continue;
                }
                if (!issue.textMatch || typeof issue.textMatch !== 'string') {
                    continue;
                }

                // Determine which occurrence to find
                let targetOccurrence: number;
                if (typeof issue.occurrenceIndex === 'number') {
                    // AI specified which occurrence
                    targetOccurrence = issue.occurrenceIndex;
                } else {
                    // Auto-increment: use next unused occurrence
                    targetOccurrence =
                        usedOccurrences.get(issue.textMatch) ?? 0;
                    usedOccurrences.set(issue.textMatch, targetOccurrence + 1);
                }

                // Find the nth occurrence of textMatch
                const position = this.findNthOccurrence(
                    issue.textMatch,
                    segments,
                    fullText,
                    targetOccurrence
                );
                if (!position) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn(
                            '[Tiptap Linter] Could not find text match:',
                            JSON.stringify(issue.textMatch),
                            'occurrence',
                            targetOccurrence,
                            'in document'
                        );
                    }
                    continue;
                }

                // Create fix function if suggestion provided (Requirement 15.3)
                const fix = issue.suggestion
                    ? this.createTextFix(issue.suggestion)
                    : undefined;

                this.record(
                    issue.message,
                    position.from,
                    position.to,
                    this.config.severity ?? 'warning',
                    fix
                );
            }
        } catch (error) {
            // Silently fail - no issues recorded (Requirement 15.4)
            if (process.env.NODE_ENV !== 'production') {
                console.error(
                    '[Tiptap Linter] Failed to parse AI response:',
                    error
                );
            }
        }
    }

    /**
     * Abstract scan method - must be implemented by subclasses.
     * AI plugins must return a Promise.
     *
     * Requirement 12.1: Async plugins return Promise
     */
    abstract scan(): Promise<this>;
}

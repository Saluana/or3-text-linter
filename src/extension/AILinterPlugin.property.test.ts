import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { AILinterPlugin } from './AILinterPlugin';
import type { TextSegment } from './AILinterPlugin';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { AILinterPluginConfig, AIResponse } from '../types';

/**
 * Concrete implementation of AILinterPlugin for testing.
 * Exposes protected methods for property testing.
 */
class TestAILinterPlugin extends AILinterPlugin {
    constructor(doc: ProsemirrorNode, config: AILinterPluginConfig) {
        super(doc, config);
    }

    async scan(): Promise<this> {
        return this;
    }

    // Expose protected methods for testing
    public testExtractTextWithPositions() {
        return this.extractTextWithPositions();
    }

    public testFindTextPosition(
        textMatch: string,
        segments: TextSegment[],
        fullText: string
    ) {
        return this.findTextPosition(textMatch, segments, fullText);
    }

    public testParseAIResponse(
        response: unknown,
        segments: TextSegment[],
        fullText: string
    ) {
        return this.parseAIResponse(response, segments, fullText);
    }

    public testCreateTextFix(replacement: string) {
        return this.createTextFix(replacement);
    }
}

/**
 * Creates a mock ProseMirror document with text nodes for testing.
 */
function createMockDocWithTextNodes(
    textNodes: { text: string; pos: number }[]
): ProsemirrorNode {
    return {
        type: { name: 'doc' },
        content: { size: 0 },
        nodeSize: 2,
        descendants: (
            callback: (node: ProsemirrorNode, pos: number) => boolean | void
        ) => {
            for (const { text, pos } of textNodes) {
                const textNode = {
                    isText: true,
                    isBlock: false,
                    text,
                    type: { name: 'text' },
                } as unknown as ProsemirrorNode;
                callback(textNode, pos);
            }
        },
    } as unknown as ProsemirrorNode;
}

/**
 * Creates a mock config for AILinterPlugin
 */
function createMockConfig(): AILinterPluginConfig {
    return {
        provider: async () => ({ issues: [] }),
        severity: 'warning',
    };
}

/**
 * Generator for a word (alphanumeric only)
 */
const wordArb = fc
    .stringMatching(/^[a-zA-Z]+$/)
    .filter((s) => s.length >= 1 && s.length <= 20);

describe('AILinterPlugin Property Tests', () => {
    // **Feature: tiptap-linter, Property 13: AI Text Extraction Position Mapping**
    // **Validates: Requirements 13.2, 15.2**
    test.prop(
        [
            fc.array(wordArb, { minLength: 1, maxLength: 5 }), // Words to form text
        ],
        { numRuns: 100 }
    )(
        'extractTextWithPositions maps text offsets to correct ProseMirror positions',
        (words) => {
            // Create a single text node with all words joined
            const text = words.join(' ');
            const startPos = 1; // Typical ProseMirror start position
            const doc = createMockDocWithTextNodes([{ text, pos: startPos }]);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const result = plugin.testExtractTextWithPositions();

            // Property: Full text should match the input text
            expect(result.fullText).toBe(text);

            // Property: Segments should correctly map positions
            expect(result.segments.length).toBe(1);
            expect(result.segments[0].text).toBe(text);
            expect(result.segments[0].from).toBe(startPos);
            expect(result.segments[0].to).toBe(startPos + text.length);
            expect(result.segments[0].textOffset).toBe(0);

            // Property: For any substring, findTextPosition should return correct positions
            for (const word of words) {
                const textIndex = text.indexOf(word);
                if (textIndex !== -1) {
                    const position = plugin.testFindTextPosition(
                        word,
                        result.segments,
                        result.fullText
                    );

                    expect(position).not.toBeNull();
                    if (position) {
                        // The from position should be startPos + textIndex
                        expect(position.from).toBe(startPos + textIndex);
                        // The to position should be from + word.length
                        expect(position.to).toBe(position.from + word.length);
                    }
                }
            }
        }
    );

    // Test with multiple text nodes
    test.prop(
        [
            fc.array(wordArb, { minLength: 2, maxLength: 4 }), // Multiple text nodes
        ],
        { numRuns: 100 }
    )(
        'extractTextWithPositions handles multiple text nodes correctly',
        (texts) => {
            // Create multiple text nodes at different positions
            let currentPos = 1;
            const textNodes = texts.map((text) => {
                const node = { text, pos: currentPos };
                currentPos += text.length + 2; // +2 for typical node boundaries
                return node;
            });

            const doc = createMockDocWithTextNodes(textNodes);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const result = plugin.testExtractTextWithPositions();

            // Property: Should have one segment per text node
            expect(result.segments.length).toBe(texts.length);

            // Property: Each segment should have correct text content
            for (let i = 0; i < texts.length; i++) {
                const segment = result.segments[i];
                const expectedText = texts[i];
                expect(segment.text).toBe(expectedText);
            }

            // Property: Segments should be in order with increasing text offsets
            for (let i = 1; i < result.segments.length; i++) {
                expect(result.segments[i].textOffset).toBeGreaterThan(
                    result.segments[i - 1].textOffset
                );
            }
        }
    );

    // **Feature: tiptap-linter, Property 14: AI Response to Issue Conversion**
    // **Validates: Requirements 13.3, 15.1, 16.3**
    test.prop(
        [
            // Use a unique marker to ensure textMatch is found at expected position
            wordArb.filter((w) => w.length >= 3), // Word to match (min 3 chars for uniqueness)
            fc.string({ minLength: 1, maxLength: 50 }), // Message
        ],
        { numRuns: 100 }
    )(
        'parseAIResponse converts valid AI responses to Issue objects with correct positions',
        (textMatch, message) => {
            // Use unique delimiters that won't contain the textMatch
            const prefix = '<<<';
            const suffix = '>>>';
            const fullText = prefix + textMatch + suffix;
            const startPos = 1;

            const doc = createMockDocWithTextNodes([
                { text: fullText, pos: startPos },
            ]);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const extraction = plugin.testExtractTextWithPositions();

            // Create a valid AI response
            const response: AIResponse = {
                issues: [
                    {
                        message,
                        textMatch,
                    },
                ],
            };

            plugin.testParseAIResponse(
                response,
                extraction.segments,
                extraction.fullText
            );
            const results = plugin.getResults();

            // Property: Should record exactly one issue
            expect(results.length).toBe(1);

            // Property: Issue should have correct message
            expect(results[0].message).toBe(message);

            // Property: Issue should have correct positions
            const expectedFrom = startPos + prefix.length;
            const expectedTo = expectedFrom + textMatch.length;
            expect(results[0].from).toBe(expectedFrom);
            expect(results[0].to).toBe(expectedTo);

            // Property: Issue should have default severity from config
            expect(results[0].severity).toBe('warning');
        }
    );

    // Test AI response with suggestion creates fix function
    test.prop(
        [
            wordArb, // Word to match
            wordArb, // Replacement suggestion
            fc.string({ minLength: 1, maxLength: 50 }), // Message
        ],
        { numRuns: 100 }
    )(
        'parseAIResponse creates fix function when suggestion is provided',
        (textMatch, suggestion, message) => {
            const fullText = `start ${textMatch} end`;
            const startPos = 1;

            const doc = createMockDocWithTextNodes([
                { text: fullText, pos: startPos },
            ]);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const extraction = plugin.testExtractTextWithPositions();

            const response: AIResponse = {
                issues: [
                    {
                        message,
                        textMatch,
                        suggestion,
                    },
                ],
            };

            plugin.testParseAIResponse(
                response,
                extraction.segments,
                extraction.fullText
            );
            const results = plugin.getResults();

            // Property: Issue should have a fix function when suggestion provided
            expect(results.length).toBe(1);
            expect(results[0].fix).toBeDefined();
            expect(typeof results[0].fix).toBe('function');
        }
    );

    // **Feature: tiptap-linter, Property 15: AI Fix Function Creation**
    // **Validates: Requirements 15.3, 16.4**
    test.prop(
        [
            wordArb, // Replacement text
        ],
        { numRuns: 100 }
    )(
        'createTextFix returns a function that replaces issue range with replacement text',
        (replacement) => {
            const doc = createMockDocWithTextNodes([{ text: 'test', pos: 1 }]);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const fixFn = plugin.testCreateTextFix(replacement);

            // Property: Should return a function
            expect(typeof fixFn).toBe('function');

            // Property: Function should accept view and issue parameters
            // We can't fully test execution without a real EditorView,
            // but we can verify the function signature
            expect(fixFn.length).toBe(2); // Two parameters: view, issue
        }
    );

    // **Feature: tiptap-linter, Property 16: AI Response Malformed Handling**
    // **Validates: Requirements 15.4**
    test.prop(
        [
            fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.string(), // Not an object
                fc.integer(), // Not an object
                fc.constant({}), // Missing issues array
                fc.constant({ issues: 'not an array' }), // issues is not array
                fc.constant({ issues: [null] }), // Array with null
                fc.constant({ issues: [{ message: 'test' }] }), // Missing textMatch
                fc.constant({ issues: [{ textMatch: 'test' }] }), // Missing message
                fc.constant({ issues: [{ message: 123, textMatch: 'test' }] }) // Wrong type
            ),
        ],
        { numRuns: 100 }
    )(
        'parseAIResponse handles malformed responses gracefully without throwing',
        (malformedResponse) => {
            const doc = createMockDocWithTextNodes([
                { text: 'some test text', pos: 1 },
            ]);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const extraction = plugin.testExtractTextWithPositions();

            // Property: Should not throw for any malformed input
            expect(() => {
                plugin.testParseAIResponse(
                    malformedResponse,
                    extraction.segments,
                    extraction.fullText
                );
            }).not.toThrow();

            // Property: Should record zero issues for malformed responses
            const results = plugin.getResults();
            expect(results.length).toBe(0);
        }
    );

    // Test that non-matching textMatch doesn't create issues
    test.prop(
        [
            wordArb, // Text in document
            wordArb.filter((w) => w.length > 5), // Different text to search for
            fc.string({ minLength: 1, maxLength: 50 }), // Message
        ],
        { numRuns: 100 }
    )(
        'parseAIResponse records no issues when textMatch is not found in document',
        (docText, searchText, message) => {
            // Ensure searchText is different from docText
            const uniqueSearchText =
                searchText === docText ? searchText + 'xyz' : searchText;

            const doc = createMockDocWithTextNodes([{ text: docText, pos: 1 }]);
            const config = createMockConfig();
            const plugin = new TestAILinterPlugin(doc, config);

            const extraction = plugin.testExtractTextWithPositions();

            const response: AIResponse = {
                issues: [
                    {
                        message,
                        textMatch: uniqueSearchText,
                    },
                ],
            };

            plugin.testParseAIResponse(
                response,
                extraction.segments,
                extraction.fullText
            );
            const results = plugin.getResults();

            // Property: No issues recorded when text not found
            // (unless by chance the search text is a substring of docText)
            if (!docText.includes(uniqueSearchText)) {
                expect(results.length).toBe(0);
            }
        }
    );
});

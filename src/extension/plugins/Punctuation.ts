import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { LinterPlugin } from '../LinterPlugin';
import type { Issue } from '../../types';

/**
 * Punctuation plugin detects suspicious punctuation spacing.
 * Specifically, it finds spaces before punctuation marks (comma, period,
 * exclamation, question, colon) which is typically incorrect.
 *
 * This plugin finds ALL matches in each text node (not just the first)
 * by properly iterating with regex.exec() and resetting lastIndex.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export class Punctuation extends LinterPlugin {
    // Matches one or more spaces followed by punctuation marks
    // Captures: group 1 = the spaces, group 2 = the punctuation mark
    private regex: RegExp;

    constructor(doc: ProsemirrorNode) {
        super(doc);
        // Global flag is required for finding all matches with exec()
        // Matches: space(s) before comma, period, exclamation, question, or colon
        this.regex = /(\s+)([,\.!?:])/g;
    }

    scan(): this {
        this.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                this.scanTextNode(node.text, pos);
            }
        });
        return this;
    }

    private scanTextNode(text: string, basePos: number): void {
        // Reset lastIndex before scanning each text node (Requirement 6.4)
        this.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        // Iterate ALL matches using while loop (Requirement 6.4)
        while ((match = this.regex.exec(text)) !== null) {
            const fullMatch = match[0]; // e.g., " ," or "  ."
            const punctuation = match[2]; // The punctuation mark
            const from = basePos + match.index;
            const to = from + fullMatch.length;

            // Create fix function that replaces with correct spacing (Requirement 6.3)
            const fix = this.createFix(punctuation);

            // Record issue with fix function (Requirements 6.1, 6.2)
            this.record(
                `Unexpected space before "${punctuation}"`,
                from,
                to,
                'warning',
                fix
            );
        }
    }

    /**
     * Creates a fix function that replaces the malformed text with
     * properly spaced punctuation (punctuation only, removing the space before).
     * Does not add trailing space - let the user decide spacing after punctuation.
     */
    private createFix(punctuation: string) {
        return (view: EditorView, issue: Issue): void => {
            // Replace " ," with just "," (remove space before only)
            const tr = view.state.tr.replaceWith(
                issue.from,
                issue.to,
                view.state.schema.text(punctuation)
            );
            view.dispatch(tr);
        };
    }
}

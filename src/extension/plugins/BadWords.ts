import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { LinterPlugin } from '../LinterPlugin';

/**
 * BadWords plugin detects discouraged words in the document.
 * Default bad words: obviously, clearly, evidently, simply
 *
 * This plugin finds ALL matches in each text node (not just the first)
 * by properly iterating with regex.exec() and resetting lastIndex.
 */
export class BadWords extends LinterPlugin {
    private regex: RegExp;

    constructor(doc: ProsemirrorNode) {
        super(doc);
        // Global flag is required for finding all matches with exec()
        this.regex = /\b(obviously|clearly|evidently|simply)\b/gi;
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
        // Reset lastIndex before scanning each text node (Requirement 4.2)
        this.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        // Iterate ALL matches using while loop (Requirements 4.1, 4.3, 5.3)
        while ((match = this.regex.exec(text)) !== null) {
            const word = match[1]; // The captured bad word
            const from = basePos + match.index;
            const to = from + match[0].length;

            // Record issue with the word in the message (Requirements 5.1, 5.2)
            this.record(`Avoid using "${word}"`, from, to, 'warning');
        }
    }
}

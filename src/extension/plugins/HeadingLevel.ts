import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { LinterPlugin } from '../LinterPlugin';
import type { Issue } from '../../types';

/**
 * HeadingLevel plugin detects heading level jumps greater than 1.
 * For example, jumping from H1 directly to H3 is flagged as an issue.
 *
 * This plugin tracks the last seen heading level during scan and
 * records issues when a heading level jumps by more than one.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export class HeadingLevel extends LinterPlugin {
    constructor(doc: ProsemirrorNode) {
        super(doc);
    }

    scan(): this {
        // Track the last heading level seen (Requirement 7.1)
        let lastHeadingLevel: number | null = null;

        this.doc.descendants((node, pos) => {
            // Check if this is a heading node
            if (node.type.name === 'heading') {
                const currentLevel = node.attrs.level as number;

                // Detect level jumps > 1 (Requirement 7.2)
                if (lastHeadingLevel !== null) {
                    const levelJump = currentLevel - lastHeadingLevel;

                    if (levelJump > 1) {
                        // Calculate the correct level (previous + 1)
                        const expectedLevel = lastHeadingLevel + 1;

                        // Store node position for fix function (Requirement 7.4)
                        const nodePos = pos;

                        // Create fix function using setNodeMarkup (Requirement 7.3)
                        const fix = this.createFix(nodePos, expectedLevel);

                        // Record issue for the heading
                        // Position spans the entire heading node
                        const from = pos;
                        const to = pos + node.nodeSize;

                        this.record(
                            `Heading level jumps from H${lastHeadingLevel} to H${currentLevel}. Expected H${expectedLevel}.`,
                            from,
                            to,
                            'warning',
                            fix
                        );
                    }
                }

                // Update last heading level for next iteration
                lastHeadingLevel = currentLevel;
            }
        });

        return this;
    }

    /**
     * Creates a fix function that adjusts the heading to the correct level
     * using setNodeMarkup to preserve the heading content.
     */
    private createFix(nodePos: number, expectedLevel: number) {
        return (view: EditorView, _issue: Issue): void => {
            // Use setNodeMarkup to change the heading level (Requirement 7.4)
            const tr = view.state.tr
                .setNodeMarkup(nodePos, undefined, {
                    level: expectedLevel,
                })
                .setMeta('linterFix', true); // Mark as linter fix to preserve async issues
            view.dispatch(tr);
        };
    }
}

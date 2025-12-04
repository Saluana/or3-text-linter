import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { HeadingLevel } from './HeadingLevel';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Creates a mock ProseMirror document with heading nodes for testing.
 * The mock simulates the descendants() traversal that HeadingLevel uses.
 */
function createMockDocWithHeadings(
    headings: { level: number; pos: number; nodeSize: number }[]
): ProsemirrorNode {
    return {
        type: { name: 'doc' },
        content: { size: 0 },
        nodeSize: 2,
        descendants: (
            callback: (node: ProsemirrorNode, pos: number) => void
        ) => {
            for (const { level, pos, nodeSize } of headings) {
                const headingNode = {
                    isText: false,
                    type: { name: 'heading' },
                    attrs: { level },
                    nodeSize,
                } as unknown as ProsemirrorNode;
                callback(headingNode, pos);
            }
        },
    } as unknown as ProsemirrorNode;
}

/**
 * Creates a mock EditorView that tracks setNodeMarkup calls.
 */
function createMockEditorView(): {
    view: EditorView;
    getAppliedLevel: () => number | null;
    getAppliedPos: () => number | null;
} {
    let appliedLevel: number | null = null;
    let appliedPos: number | null = null;

    const view = {
        state: {
            tr: {
                setNodeMarkup: (
                    pos: number,
                    _type: unknown,
                    attrs: { level: number }
                ) => {
                    appliedPos = pos;
                    appliedLevel = attrs.level;
                    return view.state.tr;
                },
            },
        },
        dispatch: () => {},
    } as unknown as EditorView;

    return {
        view,
        getAppliedLevel: () => appliedLevel,
        getAppliedPos: () => appliedPos,
    };
}

/**
 * Generator for valid heading levels (1-6)
 */
const headingLevelArb = fc.integer({ min: 1, max: 6 });

/**
 * Generator for a sequence of heading levels that contains at least one jump > 1
 */
const headingSequenceWithJumpArb = fc
    .tuple(
        headingLevelArb, // First heading level
        fc.integer({ min: 2, max: 4 }) // Jump amount (must be > 1)
    )
    .filter(([firstLevel, jump]) => firstLevel + jump <= 6)
    .map(([firstLevel, jump]) => ({
        firstLevel,
        secondLevel: firstLevel + jump,
        expectedLevel: firstLevel + 1,
    }));

/**
 * Generator for a sequence of heading levels with NO jumps > 1
 */
const validHeadingSequenceArb = fc
    .array(headingLevelArb, { minLength: 2, maxLength: 5 })
    .map((levels) => {
        // Ensure no jumps > 1 by adjusting levels
        const adjusted: number[] = [levels[0]];
        for (let i = 1; i < levels.length; i++) {
            const prev = adjusted[i - 1];
            const current = levels[i];
            // If jump > 1, adjust to be at most prev + 1
            if (current > prev + 1) {
                adjusted.push(prev + 1);
            } else {
                adjusted.push(current);
            }
        }
        return adjusted;
    });

describe('HeadingLevel Property Tests', () => {
    // **Feature: tiptap-linter, Property 9: HeadingLevel Detection**
    // **Validates: Requirements 7.2**
    test.prop([headingSequenceWithJumpArb], { numRuns: 100 })(
        'detects heading level jumps greater than 1',
        ({ firstLevel, secondLevel, expectedLevel }) => {
            // Create document with two headings where second jumps > 1
            const headings = [
                { level: firstLevel, pos: 0, nodeSize: 10 },
                { level: secondLevel, pos: 15, nodeSize: 10 },
            ];
            const doc = createMockDocWithHeadings(headings);

            const plugin = new HeadingLevel(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Plugin SHALL record an issue for the heading that jumps
            expect(results.length).toBe(1);

            // Property: Issue message should mention the level jump
            expect(results[0].message).toContain(`H${firstLevel}`);
            expect(results[0].message).toContain(`H${secondLevel}`);
            expect(results[0].message).toContain(`H${expectedLevel}`);

            // Property: Issue should have a fix function
            expect(results[0].fix).toBeDefined();
        }
    );

    // Test: No issues for valid heading sequences
    test.prop([validHeadingSequenceArb], { numRuns: 100 })(
        'does not report issues for valid heading sequences (no jumps > 1)',
        (levels) => {
            // Create document with headings that have no jumps > 1
            const headings = levels.map((level, i) => ({
                level,
                pos: i * 20,
                nodeSize: 10,
            }));
            const doc = createMockDocWithHeadings(headings);

            const plugin = new HeadingLevel(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Plugin SHALL NOT record any issues for valid sequences
            expect(results.length).toBe(0);
        }
    );

    // **Feature: tiptap-linter, Property 10: HeadingLevel Fix Round-Trip**
    // **Validates: Requirements 7.3, 7.4**
    test.prop([headingSequenceWithJumpArb], { numRuns: 100 })(
        'fix function sets heading to previous level + 1',
        ({ firstLevel, secondLevel }) => {
            const secondHeadingPos = 15;
            const headings = [
                { level: firstLevel, pos: 0, nodeSize: 10 },
                { level: secondLevel, pos: secondHeadingPos, nodeSize: 10 },
            ];
            const doc = createMockDocWithHeadings(headings);

            const plugin = new HeadingLevel(doc);
            plugin.scan();
            const results = plugin.getResults();

            expect(results.length).toBe(1);
            expect(results[0].fix).toBeDefined();

            // Apply the fix
            const { view, getAppliedLevel, getAppliedPos } =
                createMockEditorView();
            if (results[0].fix) {
                results[0].fix(view, results[0]);
            }

            // Property: Fix SHALL set heading level to previous level + 1
            const expectedLevel = firstLevel + 1;
            expect(getAppliedLevel()).toBe(expectedLevel);

            // Property: Fix SHALL use the stored node position
            expect(getAppliedPos()).toBe(secondHeadingPos);
        }
    );

    // Test: Multiple heading jumps in sequence
    test.prop(
        [
            fc.integer({ min: 1, max: 2 }), // First level (low to allow multiple jumps)
        ],
        { numRuns: 100 }
    )('detects multiple heading level jumps in document', (firstLevel) => {
        // Create H1 -> H4 -> H6 (two jumps)
        const secondLevel = Math.min(firstLevel + 2, 6);
        const thirdLevel = Math.min(secondLevel + 2, 6);

        // Only test if we actually have two jumps
        if (
            secondLevel - firstLevel <= 1 ||
            thirdLevel - secondLevel <= 1 ||
            thirdLevel > 6
        ) {
            return; // Skip this case
        }

        const headings = [
            { level: firstLevel, pos: 0, nodeSize: 10 },
            { level: secondLevel, pos: 15, nodeSize: 10 },
            { level: thirdLevel, pos: 30, nodeSize: 10 },
        ];
        const doc = createMockDocWithHeadings(headings);

        const plugin = new HeadingLevel(doc);
        plugin.scan();
        const results = plugin.getResults();

        // Property: Plugin SHALL record an issue for each heading that jumps
        expect(results.length).toBe(2);

        // Each issue should have a fix function
        for (const result of results) {
            expect(result.fix).toBeDefined();
        }
    });
});

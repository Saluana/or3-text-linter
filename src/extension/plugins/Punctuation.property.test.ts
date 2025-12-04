import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { Punctuation } from './Punctuation';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

const PUNCTUATION_MARKS = [',', '.', '!', '?', ':'];

/**
 * Creates a mock ProseMirror document with text nodes for testing.
 */
function createMockDocWithText(
    textNodes: { text: string; pos: number }[]
): ProsemirrorNode {
    return {
        type: { name: 'doc' },
        content: { size: 0 },
        nodeSize: 2,
        descendants: (
            callback: (node: ProsemirrorNode, pos: number) => void
        ) => {
            for (const { text, pos } of textNodes) {
                const textNode = {
                    isText: true,
                    text,
                    type: { name: 'text' },
                } as unknown as ProsemirrorNode;
                callback(textNode, pos);
            }
        },
    } as unknown as ProsemirrorNode;
}

/**
 * Creates a mock EditorView that tracks dispatched transactions.
 * Returns the resulting text after applying the fix.
 */
function createMockEditorView(originalText: string): {
    view: EditorView;
    getResultText: () => string;
} {
    let currentText = originalText;

    const view = {
        state: {
            schema: {
                text: (content: string) => ({ text: content }),
            },
            tr: {
                replaceWith: (
                    from: number,
                    to: number,
                    node: { text: string }
                ) => {
                    // Apply the replacement to currentText
                    currentText =
                        currentText.slice(0, from) +
                        node.text +
                        currentText.slice(to);
                    return view.state.tr;
                },
            },
        },
        dispatch: () => {},
    } as unknown as EditorView;

    return {
        view,
        getResultText: () => currentText,
    };
}

/**
 * Generator for a punctuation mark
 */
const punctuationArb = fc.constantFrom(...PUNCTUATION_MARKS);

/**
 * Generator for a word (letters only, no spaces or punctuation)
 */
const wordArb = fc
    .string({ minLength: 1, maxLength: 10 })
    .filter((s) => /^[a-zA-Z]+$/.test(s));

/**
 * Generator for whitespace (1-3 spaces)
 */
const spacesArb = fc.integer({ min: 1, max: 3 }).map((n) => ' '.repeat(n));

describe('Punctuation Property Tests', () => {
    // **Feature: tiptap-linter, Property 8: Punctuation Fix Round-Trip**
    // **Validates: Requirements 6.1, 6.2, 6.3**
    test.prop(
        [
            wordArb, // Word before the space
            spacesArb, // Space(s) before punctuation (the problem)
            punctuationArb, // The punctuation mark
            wordArb, // Word after punctuation
        ],
        { numRuns: 100 }
    )(
        'after applying fix, punctuation has no space before and one space after',
        (wordBefore, spaces, punctuation, wordAfter) => {
            // Create text with suspicious spacing: "word ,next" or "word  .next"
            const originalText = `${wordBefore}${spaces}${punctuation}${wordAfter}`;
            const doc = createMockDocWithText([{ text: originalText, pos: 0 }]);

            // Scan for issues
            const plugin = new Punctuation(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Plugin SHALL detect the space before punctuation
            expect(results.length).toBe(1);
            expect(results[0].fix).toBeDefined();

            // Apply the fix
            const { view, getResultText } = createMockEditorView(originalText);
            results[0].fix!(view, results[0]);

            const resultText = getResultText();

            // Property: After fix, punctuation SHALL have no space before
            // and exactly one space after
            const expectedText = `${wordBefore}${punctuation} ${wordAfter}`;
            expect(resultText).toBe(expectedText);

            // Additional verification: no space before punctuation
            const punctIndex = resultText.indexOf(punctuation);
            expect(punctIndex).toBeGreaterThan(0);
            expect(resultText[punctIndex - 1]).not.toBe(' ');

            // Additional verification: exactly one space after punctuation
            expect(resultText[punctIndex + 1]).toBe(' ');
        }
    );

    // Test: Multiple punctuation issues in single text node (Requirement 6.4)
    test.prop(
        [
            fc.array(fc.tuple(wordArb, spacesArb, punctuationArb), {
                minLength: 2,
                maxLength: 4,
            }),
            wordArb, // Final word
        ],
        { numRuns: 100 }
    )(
        'records separate issue for each punctuation spacing problem',
        (segments, finalWord) => {
            // Build text like "word ,word  .word !end"
            const text =
                segments
                    .map(([word, space, punct]) => `${word}${space}${punct}`)
                    .join('') + finalWord;

            const doc = createMockDocWithText([{ text, pos: 0 }]);

            const plugin = new Punctuation(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Plugin SHALL record exactly N issues for N punctuation problems
            expect(results.length).toBe(segments.length);

            // Property: Each issue SHALL have a fix function
            for (const result of results) {
                expect(result.fix).toBeDefined();
            }
        }
    );

    // Test: Detection of all punctuation types (Requirement 6.1)
    test.prop([wordArb, spacesArb, wordArb], { numRuns: 100 })(
        'detects space before all punctuation types',
        (wordBefore, spaces, wordAfter) => {
            for (const punct of PUNCTUATION_MARKS) {
                const text = `${wordBefore}${spaces}${punct}${wordAfter}`;
                const doc = createMockDocWithText([{ text, pos: 0 }]);

                const plugin = new Punctuation(doc);
                plugin.scan();
                const results = plugin.getResults();

                // Property: Plugin SHALL detect space before each punctuation type
                expect(results.length).toBe(1);
                expect(results[0].message).toContain(punct);
            }
        }
    );
});

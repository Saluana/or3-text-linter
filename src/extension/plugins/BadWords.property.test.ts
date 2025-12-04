import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { BadWords } from './BadWords';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

const BAD_WORDS = ['obviously', 'clearly', 'evidently', 'simply'];

/**
 * Creates a mock ProseMirror document with text nodes for testing.
 * The mock simulates the descendants() traversal that BadWords uses.
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
 * Generator for a bad word (case-insensitive variations)
 */
const badWordArb = fc
    .constantFrom(...BAD_WORDS)
    .chain((word) =>
        fc.constantFrom(
            word.toLowerCase(),
            word.toUpperCase(),
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
    );

/**
 * Generator for a "safe" word that is NOT a bad word
 */
const safeWordArb = fc
    .string({ minLength: 1, maxLength: 10 })
    .filter((s) => /^[a-zA-Z]+$/.test(s))
    .filter((s) => !BAD_WORDS.includes(s.toLowerCase()));

describe('BadWords Property Tests', () => {
    // **Feature: tiptap-linter, Property 1: Regex All-Matches Detection**
    // **Validates: Requirements 4.1, 4.3, 5.3**
    test.prop(
        [
            fc.integer({ min: 1, max: 5 }), // Number of bad words to insert
            fc.array(safeWordArb, { minLength: 1, maxLength: 10 }), // Safe words as filler
        ],
        { numRuns: 100 }
    )(
        'finds ALL regex matches in text node, not just the first',
        (badWordCount, safeWords) => {
            // Build text with exactly badWordCount bad words interspersed with safe words
            const badWordsToInsert = Array.from(
                { length: badWordCount },
                () => BAD_WORDS[Math.floor(Math.random() * BAD_WORDS.length)]
            );

            // Interleave safe words and bad words
            const parts: string[] = [];
            for (let i = 0; i < badWordCount; i++) {
                if (safeWords[i % safeWords.length]) {
                    parts.push(safeWords[i % safeWords.length]);
                }
                parts.push(badWordsToInsert[i]);
            }
            // Add remaining safe words
            parts.push(safeWords[safeWords.length - 1] || 'end');

            const text = parts.join(' ');
            const doc = createMockDocWithText([{ text, pos: 0 }]);

            const plugin = new BadWords(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Plugin SHALL record exactly N issues for N bad words
            expect(results.length).toBe(badWordCount);
        }
    );

    // **Feature: tiptap-linter, Property 7: BadWords Detection with Message**
    // **Validates: Requirements 5.1, 5.2**
    test.prop(
        [
            badWordArb, // A bad word (with case variations)
            safeWordArb, // Prefix word
            safeWordArb, // Suffix word
        ],
        { numRuns: 100 }
    )(
        'records issue with message containing the detected bad word',
        (badWord, prefix, suffix) => {
            const text = `${prefix} ${badWord} ${suffix}`;
            const doc = createMockDocWithText([{ text, pos: 0 }]);

            const plugin = new BadWords(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Plugin SHALL detect the bad word
            expect(results.length).toBe(1);

            // Property: Message SHALL contain the detected word (case-insensitive check)
            const message = results[0].message.toLowerCase();
            expect(message).toContain(badWord.toLowerCase());
        }
    );

    // Additional test: Multiple bad words in single text node
    test.prop([fc.array(badWordArb, { minLength: 2, maxLength: 5 })], {
        numRuns: 100,
    })(
        'records separate issue for each bad word occurrence in single text node',
        (badWords) => {
            const text = badWords.join(' and ');
            const doc = createMockDocWithText([{ text, pos: 0 }]);

            const plugin = new BadWords(doc);
            plugin.scan();
            const results = plugin.getResults();

            // Property: Each bad word gets its own issue
            expect(results.length).toBe(badWords.length);

            // Property: Each issue message contains its corresponding bad word
            for (let i = 0; i < badWords.length; i++) {
                const expectedWord = badWords[i].toLowerCase();
                const foundIssue = results.some((r) =>
                    r.message.toLowerCase().includes(expectedWord)
                );
                expect(foundIssue).toBe(true);
            }
        }
    );
});

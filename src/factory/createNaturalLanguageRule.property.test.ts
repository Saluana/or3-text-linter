import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { createNaturalLanguageRule } from './createNaturalLanguageRule';
import type { NaturalLanguageRuleConfig } from './createNaturalLanguageRule';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { AIProviderFn, AIResponse } from '../types';

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
 * Creates a mock AI provider that returns the given response.
 */
function createMockProvider(response: AIResponse): AIProviderFn {
    return async () => response;
}

/**
 * Generator for a non-empty rule string
 */
const ruleArb = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0);

/**
 * Generator for a word (alphanumeric only)
 */
const wordArb = fc
    .stringMatching(/^[a-zA-Z]+$/)
    .filter((s) => s.length >= 1 && s.length <= 20);

/**
 * Generator for severity
 */
const severityArb: fc.Arbitrary<'info' | 'warning' | 'error'> = fc.constantFrom(
    'info',
    'warning',
    'error'
);

describe('createNaturalLanguageRule Property Tests', () => {
    // **Feature: tiptap-linter, Property 17: Natural Language Rule Factory Output**
    // **Validates: Requirements 17.1**
    test.prop(
        [
            ruleArb, // Rule description
            severityArb, // Severity
        ],
        { numRuns: 100 }
    )(
        'createNaturalLanguageRule returns a valid AsyncLinterPluginClass that can be instantiated and scanned',
        async (rule, severity) => {
            const mockProvider = createMockProvider({ issues: [] });

            const config: NaturalLanguageRuleConfig = {
                rule,
                provider: mockProvider,
                severity,
            };

            // Property: Factory should return a class (constructor function)
            const PluginClass = createNaturalLanguageRule(config);
            expect(typeof PluginClass).toBe('function');

            // Property: Class should be instantiable with a ProseMirror document
            const doc = createMockDocWithTextNodes([
                { text: 'test content', pos: 1 },
            ]);
            const plugin = new PluginClass(doc);
            expect(plugin).toBeDefined();

            // Property: Instance should have scan method that returns a Promise
            expect(typeof plugin.scan).toBe('function');
            const scanResult = plugin.scan();
            expect(scanResult).toBeInstanceOf(Promise);

            // Property: scan() should resolve to the plugin instance
            const resolved = await scanResult;
            expect(resolved).toBe(plugin);

            // Property: Instance should have getResults method
            expect(typeof plugin.getResults).toBe('function');
            const results = plugin.getResults();
            expect(Array.isArray(results)).toBe(true);
        }
    );

    // Test that factory handles optional parameters correctly
    test.prop(
        [
            ruleArb, // Rule description
            fc.option(severityArb), // Optional severity
            fc.option(fc.integer({ min: 100, max: 5000 })), // Optional debounceMs
        ],
        { numRuns: 100 }
    )(
        'createNaturalLanguageRule handles optional parameters correctly',
        async (rule, severityOpt, debounceMsOpt) => {
            const mockProvider = createMockProvider({ issues: [] });

            const config: NaturalLanguageRuleConfig = {
                rule,
                provider: mockProvider,
                ...(severityOpt !== null && { severity: severityOpt }),
                ...(debounceMsOpt !== null && { debounceMs: debounceMsOpt }),
            };

            // Property: Factory should not throw with any valid config
            expect(() => createNaturalLanguageRule(config)).not.toThrow();

            const PluginClass = createNaturalLanguageRule(config);
            const doc = createMockDocWithTextNodes([
                { text: 'test content', pos: 1 },
            ]);

            // Property: Plugin should be instantiable
            expect(() => new PluginClass(doc)).not.toThrow();
        }
    );

    // **Feature: tiptap-linter, Property 18: Natural Language Rule Provider Invocation**
    // **Validates: Requirements 16.2, 17.5**
    test.prop(
        [
            ruleArb, // Rule description
            wordArb, // Document content word
        ],
        { numRuns: 100 }
    )(
        'natural language rule invokes provider with prompt containing rule and content from document',
        async (rule, contentWord) => {
            let capturedPrompt: string | null = null;
            let capturedContent: string | null = null;

            const trackingProvider: AIProviderFn = async (prompt, content) => {
                capturedPrompt = prompt;
                capturedContent = content;
                return { issues: [] };
            };

            const config: NaturalLanguageRuleConfig = {
                rule,
                provider: trackingProvider,
            };

            const PluginClass = createNaturalLanguageRule(config);
            const docText = `This is ${contentWord} in the document`;
            const doc = createMockDocWithTextNodes([{ text: docText, pos: 1 }]);
            const plugin = new PluginClass(doc);

            await plugin.scan();

            // Property: Provider should have been called
            expect(capturedPrompt).not.toBeNull();
            expect(capturedContent).not.toBeNull();

            // Property: Prompt should contain the rule description (Requirement 17.5)
            expect(capturedPrompt).toContain(rule);

            // Property: Content should contain the document text (Requirement 16.2)
            expect(capturedContent).toBe(docText);
        }
    );

    // Test that provider receives system prompt with instructions
    test.prop([ruleArb], { numRuns: 100 })(
        'natural language rule generates system prompt with AI instructions',
        async (rule) => {
            let capturedPrompt: string | null = null;

            const trackingProvider: AIProviderFn = async (prompt) => {
                capturedPrompt = prompt;
                return { issues: [] };
            };

            const config: NaturalLanguageRuleConfig = {
                rule,
                provider: trackingProvider,
            };

            const PluginClass = createNaturalLanguageRule(config);
            const doc = createMockDocWithTextNodes([
                { text: 'test content', pos: 1 },
            ]);
            const plugin = new PluginClass(doc);

            await plugin.scan();

            // Property: System prompt should contain the rule
            expect(capturedPrompt).toContain(rule);

            // Property: System prompt should instruct AI to find violations
            expect(capturedPrompt).toMatch(/violation|rule/i);

            // Property: System prompt should mention issues array (tool calling is used instead of JSON in content)
            expect(capturedPrompt).toMatch(/issues/i);
        }
    );

    // **Feature: tiptap-linter, Property 19: Multiple Natural Language Rules Aggregation**
    // **Validates: Requirements 16.5**
    test.prop(
        [
            fc.array(ruleArb, { minLength: 2, maxLength: 4 }), // Multiple rules
            wordArb, // A word to use in issues
        ],
        { numRuns: 100 }
    )(
        'multiple natural language rules aggregate all issues',
        async (rules, issueWord) => {
            // Create a document with the issue word
            const docText = `This text contains ${issueWord} which may violate rules`;
            const doc = createMockDocWithTextNodes([{ text: docText, pos: 1 }]);

            // Create plugins for each rule, each returning one issue
            const plugins = rules.map((rule) => {
                const provider: AIProviderFn = async () => ({
                    issues: [
                        {
                            message: `Violation of rule: ${rule}`,
                            textMatch: issueWord,
                        },
                    ],
                });

                const PluginClass = createNaturalLanguageRule({
                    rule,
                    provider,
                });

                return new PluginClass(doc);
            });

            // Scan all plugins
            await Promise.all(plugins.map((p) => Promise.resolve(p.scan())));

            // Collect all issues
            const allIssues = plugins.flatMap((p) => p.getResults());

            // Property: Should have N issues for N rules (each rule returns 1 issue)
            expect(allIssues.length).toBe(rules.length);

            // Property: Each issue should have a message containing its rule
            for (let i = 0; i < rules.length; i++) {
                expect(allIssues[i].message).toContain(rules[i]);
            }
        }
    );

    // Test aggregation with varying issue counts per rule
    // Note: Each rule uses a unique word, and multiple issues from the same rule
    // targeting the same word will only record one issue (first occurrence)
    // because they all map to the same document position.
    test.prop(
        [
            fc.array(fc.integer({ min: 0, max: 3 }), {
                minLength: 2,
                maxLength: 4,
            }), // Issue counts per rule
        ],
        { numRuns: 100 }
    )(
        'multiple rules with varying issue counts aggregate correctly',
        async (issueCounts) => {
            // Create unique words for each issue to ensure they're found
            const uniqueWords = issueCounts.map((_, i) => `word${i}`);
            const docText = `Document with ${uniqueWords.join(
                ' and '
            )} for testing`;
            const doc = createMockDocWithTextNodes([{ text: docText, pos: 1 }]);

            const plugins = issueCounts.map((count, ruleIndex) => {
                const provider: AIProviderFn = async () => ({
                    issues: Array.from({ length: count }, (_, issueIndex) => ({
                        message: `Issue ${issueIndex} from rule ${ruleIndex}`,
                        textMatch: uniqueWords[ruleIndex],
                    })),
                });

                const PluginClass = createNaturalLanguageRule({
                    rule: `Rule ${ruleIndex}`,
                    provider,
                });

                return new PluginClass(doc);
            });

            await Promise.all(plugins.map((p) => Promise.resolve(p.scan())));

            const allIssues = plugins.flatMap((p) => p.getResults());

            // Each rule can only record issues up to the number of occurrences of its word in the doc.
            // Since each uniqueWord appears exactly once, each rule can record at most 1 issue.
            const expectedTotal = issueCounts.filter((c) => c > 0).length;

            // Property: Total issues should equal number of rules that returned at least one issue
            expect(allIssues.length).toBe(expectedTotal);
        }
    );

    // Test that empty document doesn't call provider
    test.prop([ruleArb], { numRuns: 100 })(
        'natural language rule skips provider call for empty documents',
        async (rule) => {
            let providerCalled = false;

            const trackingProvider: AIProviderFn = async () => {
                providerCalled = true;
                return { issues: [] };
            };

            const config: NaturalLanguageRuleConfig = {
                rule,
                provider: trackingProvider,
            };

            const PluginClass = createNaturalLanguageRule(config);
            // Empty document (no text nodes)
            const doc = createMockDocWithTextNodes([]);
            const plugin = new PluginClass(doc);

            await plugin.scan();

            // Property: Provider should not be called for empty documents
            expect(providerCalled).toBe(false);
        }
    );

    // Test that provider errors are handled gracefully
    test.prop([ruleArb], { numRuns: 100 })(
        'natural language rule handles provider errors gracefully',
        async (rule) => {
            const errorProvider: AIProviderFn = async () => {
                throw new Error('AI provider error');
            };

            const config: NaturalLanguageRuleConfig = {
                rule,
                provider: errorProvider,
            };

            const PluginClass = createNaturalLanguageRule(config);
            const doc = createMockDocWithTextNodes([
                { text: 'test content', pos: 1 },
            ]);
            const plugin = new PluginClass(doc);

            // Property: scan() should not throw even when provider fails
            await expect(plugin.scan()).resolves.toBe(plugin);

            // Property: Should return empty results on error
            expect(plugin.getResults()).toEqual([]);
        }
    );
});

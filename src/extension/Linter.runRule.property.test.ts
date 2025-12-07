/**
 * @vitest-environment jsdom
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Linter } from './Linter';
import { LinterPlugin } from './LinterPlugin';
import type { Severity } from '../types';

// Generator for severity values
const severityArb = fc.constantFrom(
    'info',
    'warning',
    'error'
) as fc.Arbitrary<Severity>;

// Factory to create a test plugin class with specific issues
function createTestPluginClass(
    issues: Array<{
        message: string;
        from: number;
        to: number;
        severity: Severity;
    }>
) {
    return class extends LinterPlugin {
        scan(): this {
            for (const issue of issues) {
                this.record(
                    issue.message,
                    issue.from,
                    issue.to,
                    issue.severity
                );
            }
            return this;
        }
    };
}

// Factory to create an async test plugin class with specific issues
function createAsyncTestPluginClass(
    issues: Array<{
        message: string;
        from: number;
        to: number;
        severity: Severity;
    }>,
    delayMs: number = 10
) {
    return class extends LinterPlugin {
        async scan(): Promise<this> {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            for (const issue of issues) {
                this.record(
                    issue.message,
                    issue.from,
                    issue.to,
                    issue.severity
                );
            }
            return this;
        }
    };
}

// Factory to create a plugin that throws an error
function createFailingPluginClass(errorMessage: string) {
    return class extends LinterPlugin {
        scan(): this {
            throw new Error(errorMessage);
        }
    };
}

// Factory to create an async plugin that throws an error
function createAsyncFailingPluginClass(
    errorMessage: string,
    delayMs: number = 5
) {
    return class extends LinterPlugin {
        async scan(): Promise<this> {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            throw new Error(errorMessage);
        }
    };
}

// Factory to create a plugin that produces invalid issues
function createInvalidIssuePluginClass(
    invalidIssues: Array<{
        message: string;
        from: number;
        to: number;
        severity: Severity;
    }>
) {
    return class extends LinterPlugin {
        scan(): this {
            for (const issue of invalidIssues) {
                this.record(
                    issue.message,
                    issue.from,
                    issue.to,
                    issue.severity
                );
            }
            return this;
        }
    };
}

describe('runRule Property Tests', () => {
    // **Feature: on-demand-linting, Property 1: runRule isolation**
    // **Validates: Requirements 1.1, 1.4, 3.2**
    test.prop(
        [
            // Issues for the auto plugin (will be in storage initially)
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 3 }
            ),
            // Issues for the on-demand plugin
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 15, max: 25 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 3 }
            ),
        ],
        { numRuns: 100 }
    )(
        'runRule returns only issues from specified plugin without modifying storage',
        async (autoIssueInputs, onDemandIssueInputs) => {
            // Convert inputs to valid issues
            const autoIssues = autoIssueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const onDemandIssues = onDemandIssueInputs.map((input, idx) => ({
                message: `ondemand-${input.message}`,
                from: 15 + idx,
                to: 15 + idx + input.toOffset,
                severity: input.severity,
            }));

            const AutoPluginClass = createTestPluginClass(autoIssues);
            const OnDemandPluginClass = createTestPluginClass(onDemandIssues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [AutoPluginClass],
                    }),
                ],
                content:
                    '<p>This is test content for the linter to scan with enough length for positions.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Get initial storage state
            const initialIssues = [...editor.storage.linter.getIssues()];

            // Run on-demand plugin without applyResults
            const returnedIssues = await editor.storage.linter.runRule(
                OnDemandPluginClass
            );

            // Property 1: runRule returns only issues from the specified plugin
            expect(returnedIssues).toHaveLength(onDemandIssues.length);
            for (let i = 0; i < onDemandIssues.length; i++) {
                expect(returnedIssues[i].message).toBe(
                    onDemandIssues[i].message
                );
            }

            // Property 2: Storage issues remain unchanged (isolation)
            const currentIssues = editor.storage.linter.getIssues();
            expect(currentIssues).toHaveLength(initialIssues.length);
            for (let i = 0; i < initialIssues.length; i++) {
                expect(currentIssues[i].message).toBe(initialIssues[i].message);
            }

            editor.destroy();
        }
    );
});

describe('runRule Promise Resolution Property Tests', () => {
    // **Feature: on-demand-linting, Property 2: runRule Promise resolution**
    // **Validates: Requirements 1.2, 1.3, 2.1, 2.2**
    test.prop(
        [
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 5 }
            ),
        ],
        { numRuns: 100 }
    )(
        'runRule returns Promise that resolves with issues for sync plugins',
        async (issueInputs) => {
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const SyncPluginClass = createTestPluginClass(issues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                        autoLint: false,
                    }),
                ],
                content:
                    '<p>This is test content for the linter to scan with enough length.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Property: runRule returns a Promise
            const resultPromise =
                editor.storage.linter.runRule(SyncPluginClass);
            expect(resultPromise).toBeInstanceOf(Promise);

            // Property: Promise resolves with issues array
            const result = await resultPromise;
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(issues.length);

            editor.destroy();
        }
    );

    test.prop(
        [
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 5 }
            ),
        ],
        { numRuns: 100 }
    )(
        'runRule awaits async plugins and resolves with issues',
        async (issueInputs) => {
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const AsyncPluginClass = createAsyncTestPluginClass(issues, 10);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                        autoLint: false,
                    }),
                ],
                content:
                    '<p>This is test content for the linter to scan with enough length.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Property: runRule awaits async plugin and resolves with issues
            const result = await editor.storage.linter.runRule(
                AsyncPluginClass
            );
            expect(result).toHaveLength(issues.length);

            for (let i = 0; i < issues.length; i++) {
                expect(result[i].message).toBe(issues[i].message);
                expect(result[i].severity).toBe(issues[i].severity);
            }

            editor.destroy();
        }
    );
});

describe('runRule applyResults Property Tests', () => {
    // **Feature: on-demand-linting, Property 3: runRule applyResults behavior**
    // **Validates: Requirements 3.1, 3.3**
    test.prop(
        [
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 5 }
            ),
        ],
        { numRuns: 100 }
    )(
        'runRule with applyResults true updates storage with returned issues',
        async (issueInputs) => {
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const PluginClass = createTestPluginClass(issues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                        autoLint: false,
                    }),
                ],
                content:
                    '<p>This is test content for the linter to scan with enough length.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Verify storage is initially empty
            expect(editor.storage.linter.getIssues()).toHaveLength(0);

            // Run with applyResults: true
            const result = await editor.storage.linter.runRule(PluginClass, {
                applyResults: true,
            });

            // Property: Storage is updated with exactly the returned issues
            const storedIssues = editor.storage.linter.getIssues();
            expect(storedIssues).toHaveLength(result.length);

            for (let i = 0; i < result.length; i++) {
                expect(storedIssues[i].message).toBe(result[i].message);
                expect(storedIssues[i].from).toBe(result[i].from);
                expect(storedIssues[i].to).toBe(result[i].to);
            }

            editor.destroy();
        }
    );
});

describe('runRule Error Propagation Property Tests', () => {
    // **Feature: on-demand-linting, Property 10: Error propagation**
    // **Validates: Requirements 5.1, 5.2**
    test.prop([fc.string({ minLength: 1, maxLength: 50 })], { numRuns: 100 })(
        'runRule propagates sync plugin errors',
        async (errorMessage) => {
            const FailingPluginClass = createFailingPluginClass(errorMessage);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                        autoLint: false,
                    }),
                ],
                content: '<p>Test content.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Property: runRule rejects with the plugin's error
            await expect(
                editor.storage.linter.runRule(FailingPluginClass)
            ).rejects.toThrow(errorMessage);

            editor.destroy();
        }
    );

    test.prop([fc.string({ minLength: 1, maxLength: 50 })], { numRuns: 100 })(
        'runRule propagates async plugin errors',
        async (errorMessage) => {
            const FailingAsyncPluginClass =
                createAsyncFailingPluginClass(errorMessage);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                        autoLint: false,
                    }),
                ],
                content: '<p>Test content.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Property: runRule rejects with the async plugin's error
            await expect(
                editor.storage.linter.runRule(FailingAsyncPluginClass)
            ).rejects.toThrow(errorMessage);

            editor.destroy();
        }
    );
});

describe('runRule Invalid Issue Filtering Property Tests', () => {
    // **Feature: on-demand-linting, Property 11: Invalid issue filtering**
    // **Validates: Requirements 5.3**
    test.prop(
        [
            // Valid issues
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 3 }
            ),
            // Invalid issue type: negative from
            fc.boolean(),
            // Invalid issue type: from >= to
            fc.boolean(),
            // Invalid issue type: to > docSize
            fc.boolean(),
        ],
        { numRuns: 100 }
    )(
        'runRule filters out invalid issues',
        async (
            validIssueInputs,
            includeNegativeFrom,
            includeFromGteqTo,
            includeToOutOfBounds
        ) => {
            const validIssues = validIssueInputs.map((input, idx) => ({
                message: `valid-${input.message}`,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const allIssues = [...validIssues];

            // Add invalid issues based on flags
            if (includeNegativeFrom) {
                allIssues.push({
                    message: 'negative-from',
                    from: -5,
                    to: 10,
                    severity: 'warning',
                });
            }

            if (includeFromGteqTo) {
                allIssues.push({
                    message: 'from-gteq-to',
                    from: 10,
                    to: 5,
                    severity: 'warning',
                });
            }

            if (includeToOutOfBounds) {
                allIssues.push({
                    message: 'to-out-of-bounds',
                    from: 1,
                    to: 99999,
                    severity: 'warning',
                });
            }

            const PluginClass = createInvalidIssuePluginClass(allIssues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                        autoLint: false,
                    }),
                ],
                content: '<p>Test content for filtering.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            const result = await editor.storage.linter.runRule(PluginClass);

            // Property: Only valid issues are returned
            // All returned issues should have valid positions
            for (const issue of result) {
                expect(issue.from).toBeGreaterThanOrEqual(0);
                expect(issue.to).toBeLessThanOrEqual(
                    editor.state.doc.content.size
                );
                expect(issue.from).toBeLessThan(issue.to);
            }

            // Property: Invalid issues are filtered out
            const invalidMessages = [
                'negative-from',
                'from-gteq-to',
                'to-out-of-bounds',
            ];
            for (const issue of result) {
                expect(invalidMessages).not.toContain(issue.message);
            }

            editor.destroy();
        }
    );
});

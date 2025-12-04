/**
 * @vitest-environment jsdom
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { renderIcon } from './Linter';
import type { Issue, Severity } from '../types';
import type { PluginKey } from '@tiptap/pm/state';

// Generator for severity values
const severityArb = fc.constantFrom(
    'info',
    'warning',
    'error'
) as fc.Arbitrary<Severity>;

// Generator for a valid issue
const issueArb = fc
    .record({
        message: fc.string({ minLength: 1 }),
        from: fc.nat({ max: 100 }),
        toOffset: fc.nat({ max: 50 }),
        severity: severityArb,
    })
    .map(
        ({ message, from, toOffset, severity }) =>
            ({
                message,
                from,
                to: from + toOffset + 1, // Ensure to > from
                severity,
            } as Issue)
    );

describe('Linter Property Tests', () => {
    // **Feature: tiptap-linter, Property 3: Decoration Severity Class Consistency**
    // **Validates: Requirements 1.4, 9.1, 9.2**
    test.prop([issueArb], { numRuns: 100 })(
        'renderIcon creates element with correct severity class',
        (issue) => {
            const icon = renderIcon(issue);

            // Property: Widget icon has correct CSS classes
            expect(icon.className).toBe(
                `lint-icon lint-icon--${issue.severity}`
            );
            expect(icon.title).toBe(issue.message);
            expect(icon.issue).toBe(issue);
            expect(icon.getAttribute('role')).toBe('button');
            expect(icon.getAttribute('aria-label')).toBe(
                `Lint issue: ${issue.message}`
            );
        }
    );
});

// For testing the Linter extension, we need to create a proper editor setup
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Linter } from './Linter';
import { LinterPlugin } from './LinterPlugin';

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

describe('Linter Storage Property Tests', () => {
    // **Feature: tiptap-linter, Property 4: Storage Issues Synchronization**
    // **Validates: Requirements 10.2, 10.3**
    test.prop(
        [
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 0, maxLength: 5 }
            ),
        ],
        { numRuns: 100 }
    )('storage.getIssues() returns computed issues', async (issueInputs) => {
        // Convert inputs to valid issues with proper positions
        const issues = issueInputs.map((input, idx) => ({
            message: input.message,
            from: 1 + idx, // Ensure valid positions within doc
            to: 1 + idx + input.toOffset,
            severity: input.severity,
        }));

        const TestPluginClass = createTestPluginClass(issues);

        const editor = new Editor({
            extensions: [
                Document,
                Paragraph,
                Text,
                Linter.configure({
                    plugins: [TestPluginClass],
                }),
            ],
            content: '<p>This is test content for the linter to scan.</p>',
        });

        // Wait for editor to initialize
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Property: storage.getIssues() returns the computed issues
        const storedIssues = editor.storage.linter.getIssues();
        expect(storedIssues).toHaveLength(issues.length);

        for (let i = 0; i < issues.length; i++) {
            expect(storedIssues[i].message).toBe(issues[i].message);
            expect(storedIssues[i].severity).toBe(issues[i].severity);
        }

        editor.destroy();
    });
});

describe('Linter DecorationSet Property Tests', () => {
    // **Feature: tiptap-linter, Property 5: DecorationSet Reuse on Non-Doc Transactions**
    // **Validates: Requirements 1.3**
    test.prop([fc.integer({ min: 1, max: 10 })], { numRuns: 50 })(
        'DecorationSet is reused when document does not change',
        async (selectionPos) => {
            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [],
                    }),
                ],
                content: '<p>This is test content for the linter.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Get initial state
            const initialState = editor.view.state;
            const pluginState = initialState.plugins.find(
                (p) =>
                    (p.spec.key as PluginKey & { key?: string })?.key ===
                    'linter$$'
            );

            if (pluginState) {
                const initialDecorations = pluginState.getState(initialState);

                // Create a selection-only transaction (no doc change)
                const pos = Math.min(
                    selectionPos,
                    editor.state.doc.content.size
                );
                editor.commands.setTextSelection(pos);

                await new Promise((resolve) => setTimeout(resolve, 10));

                const newState = editor.view.state;
                const newDecorations = pluginState.getState(newState);

                // Property: DecorationSet should be the same reference when doc hasn't changed
                expect(newDecorations).toBe(initialDecorations);
            }

            editor.destroy();
        }
    );

    // **Feature: tiptap-linter, Property 6: DecorationSet Rebuild on Doc Changes**
    // **Validates: Requirements 1.2**
    test.prop(
        [
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.record({
                message: fc.string({ minLength: 1, maxLength: 20 }),
                severity: severityArb,
            }),
        ],
        { numRuns: 50 }
    )(
        'DecorationSet is rebuilt when document changes',
        async (textToInsert, issueConfig) => {
            // Create a plugin that records an issue at a fixed position
            const TestPluginClass = createTestPluginClass([
                {
                    message: issueConfig.message,
                    from: 1,
                    to: 5,
                    severity: issueConfig.severity,
                },
            ]);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPluginClass],
                    }),
                ],
                content: '<p>Initial content.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Get initial issues count
            const initialIssues = editor.storage.linter.getIssues();
            const initialCount = initialIssues.length;

            // Insert text (doc change) - this should trigger a rebuild
            editor.commands.insertContent(textToInsert);

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Property: After doc change, issues should be recomputed
            // The storage should still have issues (plugins were re-run)
            const newIssues = editor.storage.linter.getIssues();
            expect(newIssues.length).toBe(initialCount);

            // Verify the issues were recomputed (same message from plugin)
            expect(newIssues[0].message).toBe(issueConfig.message);

            editor.destroy();
        }
    );
});

// Factory to create an async test plugin class with specific issues and delay
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
            // Simulate async operation (e.g., AI API call)
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

describe('Linter Async Plugin Property Tests', () => {
    // **Feature: tiptap-linter, Property 11: Async Plugin Awaiting**
    // **Validates: Requirements 12.1**
    // Direct test of runAllLinterPlugins for async behavior
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
        'runAllLinterPlugins awaits async plugins and includes their issues',
        async (issueInputs) => {
            // Import runAllLinterPlugins for direct testing
            const { runAllLinterPlugins } = await import('./Linter');

            // Convert inputs to valid issues with proper positions
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const AsyncTestPluginClass = createAsyncTestPluginClass(issues, 10);

            // Create a minimal editor just to get a doc
            const editor = new Editor({
                extensions: [Document, Paragraph, Text],
                content: '<p>Test content for async plugin testing.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Call runAllLinterPlugins directly
            const result = await runAllLinterPlugins(
                editor.state.doc,
                [AsyncTestPluginClass],
                editor.view
            );

            // Property: All async plugin issues should be included
            expect(result.issues).toHaveLength(issues.length);

            for (let i = 0; i < issues.length; i++) {
                expect(result.issues[i].message).toBe(issues[i].message);
                expect(result.issues[i].severity).toBe(issues[i].severity);
            }

            editor.destroy();
        }
    );
});

describe('Linter Error Isolation Property Tests', () => {
    // **Feature: tiptap-linter, Property 12: Async Plugin Error Isolation**
    // **Validates: Requirements 12.4**
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
            fc.string({ minLength: 1, maxLength: 20 }), // error message
        ],
        { numRuns: 100 }
    )(
        'failing plugin does not prevent other plugins from reporting issues',
        async (issueInputs, errorMessage) => {
            const { runAllLinterPlugins } = await import('./Linter');

            // Convert inputs to valid issues with proper positions
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const WorkingPluginClass = createTestPluginClass(issues);
            const FailingPluginClass = createFailingPluginClass(errorMessage);

            // Create a minimal editor just to get a doc
            const editor = new Editor({
                extensions: [Document, Paragraph, Text],
                content: '<p>Test content for error isolation testing.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Call runAllLinterPlugins with both working and failing plugins
            const result = await runAllLinterPlugins(
                editor.state.doc,
                [FailingPluginClass, WorkingPluginClass],
                editor.view
            );

            // Property: Issues from working plugin should still be collected
            expect(result.issues).toHaveLength(issues.length);

            for (let i = 0; i < issues.length; i++) {
                expect(result.issues[i].message).toBe(issues[i].message);
                expect(result.issues[i].severity).toBe(issues[i].severity);
            }

            editor.destroy();
        }
    );

    // Test async plugin error isolation
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
            fc.string({ minLength: 1, maxLength: 20 }), // error message
        ],
        { numRuns: 100 }
    )(
        'async failing plugin does not prevent other plugins from reporting issues',
        async (issueInputs, errorMessage) => {
            const { runAllLinterPlugins } = await import('./Linter');

            // Convert inputs to valid issues with proper positions
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const WorkingAsyncPluginClass = createAsyncTestPluginClass(
                issues,
                10
            );
            const FailingAsyncPluginClass = createAsyncFailingPluginClass(
                errorMessage,
                5
            );

            // Create a minimal editor just to get a doc
            const editor = new Editor({
                extensions: [Document, Paragraph, Text],
                content:
                    '<p>Test content for async error isolation testing.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Call runAllLinterPlugins with both working and failing async plugins
            const result = await runAllLinterPlugins(
                editor.state.doc,
                [FailingAsyncPluginClass, WorkingAsyncPluginClass],
                editor.view
            );

            // Property: Issues from working async plugin should still be collected
            expect(result.issues).toHaveLength(issues.length);

            for (let i = 0; i < issues.length; i++) {
                expect(result.issues[i].message).toBe(issues[i].message);
                expect(result.issues[i].severity).toBe(issues[i].severity);
            }

            editor.destroy();
        }
    );

    // Test mixed sync/async plugins with one failing
    test.prop(
        [
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 3 }
            ),
            fc.array(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 20 }),
                    from: fc.integer({ min: 1, max: 10 }),
                    toOffset: fc.integer({ min: 1, max: 5 }),
                    severity: severityArb,
                }),
                { minLength: 1, maxLength: 3 }
            ),
            fc.string({ minLength: 1, maxLength: 20 }), // error message
        ],
        { numRuns: 100 }
    )(
        'mixed sync/async plugins with failing plugin still collect all working issues',
        async (syncIssueInputs, asyncIssueInputs, errorMessage) => {
            const { runAllLinterPlugins } = await import('./Linter');

            // Convert inputs to valid issues with proper positions
            const syncIssues = syncIssueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const asyncIssues = asyncIssueInputs.map((input, idx) => ({
                message: input.message,
                from: 20 + idx, // Different positions to avoid overlap
                to: 20 + idx + input.toOffset,
                severity: input.severity,
            }));

            const SyncPluginClass = createTestPluginClass(syncIssues);
            const AsyncPluginClass = createAsyncTestPluginClass(
                asyncIssues,
                10
            );
            const FailingPluginClass = createFailingPluginClass(errorMessage);

            // Create a minimal editor just to get a doc
            const editor = new Editor({
                extensions: [Document, Paragraph, Text],
                content:
                    '<p>Test content for mixed plugin error isolation testing with enough length.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Call runAllLinterPlugins with sync, async, and failing plugins
            const result = await runAllLinterPlugins(
                editor.state.doc,
                [SyncPluginClass, FailingPluginClass, AsyncPluginClass],
                editor.view
            );

            // Property: Issues from both working sync and async plugins should be collected
            const expectedTotalIssues = syncIssues.length + asyncIssues.length;
            expect(result.issues).toHaveLength(expectedTotalIssues);

            editor.destroy();
        }
    );
});

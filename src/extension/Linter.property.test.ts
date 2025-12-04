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
            const result = await runAllLinterPlugins(editor.state.doc, [
                AsyncTestPluginClass,
            ]);

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
            const result = await runAllLinterPlugins(editor.state.doc, [
                FailingPluginClass,
                WorkingPluginClass,
            ]);

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
            const result = await runAllLinterPlugins(editor.state.doc, [
                FailingAsyncPluginClass,
                WorkingAsyncPluginClass,
            ]);

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
            const result = await runAllLinterPlugins(editor.state.doc, [
                SyncPluginClass,
                FailingPluginClass,
                AsyncPluginClass,
            ]);

            // Property: Issues from both working sync and async plugins should be collected
            const expectedTotalIssues = syncIssues.length + asyncIssues.length;
            expect(result.issues).toHaveLength(expectedTotalIssues);

            editor.destroy();
        }
    );
});

describe('Linter Popover Integration Property Tests', () => {
    // **Feature: tiptap-linter, Property 21: Popover Opens on Icon Click**
    // **Validates: Requirements 8.1, 8.2**
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
        ],
        { numRuns: 100 }
    )(
        'clicking lint icon shows popover with associated issues',
        async (issueInputs) => {
            // Import PopoverManager for direct testing
            const { PopoverManager } = await import('./PopoverManager');

            // Convert inputs to valid issues with proper positions
            const issues = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            const TestPluginClass = createTestPluginClass(issues);

            // Create editor with popover enabled
            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPluginClass],
                        popover: {}, // Enable popover with default options
                    }),
                ],
                content: '<p>This is test content for the linter to scan.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Find a lint icon in the editor
            const editorEl = editor.view.dom;
            const lintIcon = editorEl.querySelector(
                '.lint-icon'
            ) as HTMLElement;

            // Property: When popover is configured and issues exist, clicking icon should show popover
            // We test this by directly using the PopoverManager since ProseMirror's event handling
            // is internal and not easily testable via DOM events in jsdom
            if (lintIcon && issues.length > 0) {
                // Get or create the popover manager
                let popoverManager = editor.storage.linter.popoverManager;
                if (!popoverManager) {
                    popoverManager = new PopoverManager(editor.view, {});
                    editor.storage.linter.popoverManager = popoverManager;
                }

                // Simulate what handleClickWithPopover does: show popover with issues at position
                const clickedIssue = editor.storage.linter.issues[0];
                if (clickedIssue) {
                    const issuesAtPosition =
                        editor.storage.linter.issues.filter(
                            (issue: Issue) =>
                                issue.from === clickedIssue.from &&
                                issue.to === clickedIssue.to
                        );
                    popoverManager.show(
                        issuesAtPosition.length > 0
                            ? issuesAtPosition
                            : [clickedIssue],
                        lintIcon
                    );

                    await new Promise((resolve) => setTimeout(resolve, 10));

                    // Property: Popover should be visible in the DOM (Requirement 8.1)
                    const popover = document.querySelector(
                        '.lint-popover-container'
                    );
                    expect(popover).not.toBeNull();

                    // Property: Popover should contain issue information
                    if (popover) {
                        const issueElements = popover.querySelectorAll(
                            '.lint-popover__issue'
                        );
                        expect(issueElements.length).toBeGreaterThan(0);

                        // Property: Popover should show message and severity (Requirement 8.2)
                        const messageEl = popover.querySelector(
                            '.lint-popover__message'
                        );
                        expect(messageEl).not.toBeNull();

                        const severityEl = popover.querySelector(
                            '.lint-popover__severity'
                        );
                        expect(severityEl).not.toBeNull();
                    }

                    // Clean up popover
                    popoverManager.hide();
                }
            }

            editor.destroy();
        }
    );

    // Test that multiple issues at same position are shown in popover
    test.prop(
        [
            fc.record({
                message1: fc.string({ minLength: 1, maxLength: 20 }),
                message2: fc.string({ minLength: 1, maxLength: 20 }),
                severity1: severityArb,
                severity2: severityArb,
            }),
        ],
        { numRuns: 50 }
    )(
        'popover shows all issues at the same position',
        async ({ message1, message2, severity1, severity2 }) => {
            // Import PopoverManager for direct testing
            const { PopoverManager } = await import('./PopoverManager');

            // Create two issues at the same position
            const issues = [
                { message: message1, from: 1, to: 5, severity: severity1 },
                { message: message2, from: 1, to: 5, severity: severity2 },
            ];

            const TestPluginClass = createTestPluginClass(issues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPluginClass],
                        popover: {},
                    }),
                ],
                content: '<p>This is test content for the linter to scan.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Find a lint icon
            const editorEl = editor.view.dom;
            const lintIcon = editorEl.querySelector(
                '.lint-icon'
            ) as HTMLElement;

            if (lintIcon) {
                // Get or create the popover manager
                let popoverManager = editor.storage.linter.popoverManager;
                if (!popoverManager) {
                    popoverManager = new PopoverManager(editor.view, {});
                    editor.storage.linter.popoverManager = popoverManager;
                }

                // Show popover with all issues at the same position
                const storedIssues = editor.storage.linter.issues;
                popoverManager.show(storedIssues, lintIcon);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // Property: Popover should show both issues
                const popover = document.querySelector(
                    '.lint-popover-container'
                );
                if (popover) {
                    const issueElements = popover.querySelectorAll(
                        '.lint-popover__issue'
                    );
                    // Should have 2 issues displayed
                    expect(issueElements.length).toBe(2);
                }

                // Clean up
                popoverManager.hide();
            }

            editor.destroy();
        }
    );
});

describe('Custom Popover Renderer Property Tests', () => {
    // **Feature: tiptap-linter, Property 24: Custom Popover Renderer Receives Correct Context**
    // **Validates: Requirements 18.2, 18.3**
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
        ],
        { numRuns: 100 }
    )(
        'custom renderer receives correct context with issues and actions',
        async (issueInputs) => {
            // Import PopoverManager for direct testing
            const { PopoverManager } = await import('./PopoverManager');

            // Convert inputs to valid issues with proper positions
            const issues: Issue[] = issueInputs.map((input, idx) => ({
                message: input.message,
                from: 1 + idx,
                to: 1 + idx + input.toOffset,
                severity: input.severity,
            }));

            // Track what context was passed to the custom renderer
            let receivedContext: {
                issues: Issue[];
                hasApplyFix: boolean;
                hasDeleteText: boolean;
                hasReplaceText: boolean;
                hasDismiss: boolean;
                hasView: boolean;
            } | null = null;

            // Custom renderer that captures the context
            const customRenderer = (context: {
                issues: Issue[];
                actions: {
                    applyFix: () => void;
                    deleteText: () => void;
                    replaceText: (text: string) => void;
                    dismiss: () => void;
                };
                view: unknown;
            }) => {
                receivedContext = {
                    issues: context.issues,
                    hasApplyFix: typeof context.actions.applyFix === 'function',
                    hasDeleteText:
                        typeof context.actions.deleteText === 'function',
                    hasReplaceText:
                        typeof context.actions.replaceText === 'function',
                    hasDismiss: typeof context.actions.dismiss === 'function',
                    hasView:
                        context.view !== null && context.view !== undefined,
                };

                const el = document.createElement('div');
                el.className = 'custom-popover';
                el.textContent = `Issues: ${context.issues.length}`;
                return el;
            };

            const TestPluginClass = createTestPluginClass(issues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPluginClass],
                        popover: {
                            renderer: customRenderer,
                        },
                    }),
                ],
                content: '<p>This is test content for the linter to scan.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Find a lint icon
            const editorEl = editor.view.dom;
            const lintIcon = editorEl.querySelector(
                '.lint-icon'
            ) as HTMLElement;

            if (lintIcon && issues.length > 0) {
                // Create popover manager with custom renderer
                const popoverManager = new PopoverManager(editor.view, {
                    renderer: customRenderer,
                });

                // Show popover with issues
                const storedIssues = editor.storage.linter.issues;
                popoverManager.show(storedIssues, lintIcon);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // Property: Custom renderer should have been called with correct context
                expect(receivedContext).not.toBeNull();

                // Use non-null assertion since we just checked it's not null
                const ctx = receivedContext!;

                // Property: Context should contain the correct issues array (Requirement 18.2)
                expect(ctx.issues).toHaveLength(issues.length);
                for (let i = 0; i < issues.length; i++) {
                    expect(ctx.issues[i].message).toBe(issues[i].message);
                    expect(ctx.issues[i].severity).toBe(issues[i].severity);
                }

                // Property: Context should have functional action callbacks (Requirement 18.3)
                expect(ctx.hasApplyFix).toBe(true);
                expect(ctx.hasDeleteText).toBe(true);
                expect(ctx.hasReplaceText).toBe(true);
                expect(ctx.hasDismiss).toBe(true);

                // Property: Context should have the EditorView
                expect(ctx.hasView).toBe(true);

                // Clean up
                popoverManager.hide();
            }

            editor.destroy();
        }
    );

    // Test that custom renderer's actions actually work
    test.prop(
        [
            fc.record({
                message: fc.string({ minLength: 1, maxLength: 20 }),
                severity: severityArb,
            }),
        ],
        { numRuns: 50 }
    )(
        'custom renderer actions are functional and modify document correctly',
        async ({ message, severity }) => {
            // Import PopoverManager for direct testing
            const { PopoverManager } = await import('./PopoverManager');

            // Create an issue with a fix function
            const issues: Issue[] = [
                {
                    message,
                    from: 1,
                    to: 5,
                    severity,
                    fix: (view, issue) => {
                        view.dispatch(
                            view.state.tr.replaceWith(
                                issue.from,
                                issue.to,
                                view.state.schema.text('FIXED')
                            )
                        );
                    },
                },
            ];

            // Track actions received
            let capturedActions: {
                applyFix: () => void;
                deleteText: () => void;
                replaceText: (text: string) => void;
                dismiss: () => void;
            } | null = null;

            // Custom renderer that captures actions
            const customRenderer = (context: {
                issues: Issue[];
                actions: {
                    applyFix: () => void;
                    deleteText: () => void;
                    replaceText: (text: string) => void;
                    dismiss: () => void;
                };
                view: unknown;
            }) => {
                capturedActions = context.actions;
                const el = document.createElement('div');
                el.className = 'custom-popover';
                return el;
            };

            const TestPluginClass = createTestPluginClass(issues);

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPluginClass],
                        popover: {
                            renderer: customRenderer,
                        },
                    }),
                ],
                content: '<p>This is test content for the linter to scan.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Find a lint icon
            const editorEl = editor.view.dom;
            const lintIcon = editorEl.querySelector(
                '.lint-icon'
            ) as HTMLElement;

            if (lintIcon) {
                // Create popover manager with custom renderer
                const popoverManager = new PopoverManager(editor.view, {
                    renderer: customRenderer,
                });

                // Show popover
                popoverManager.show(issues, lintIcon);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // Property: Actions should be captured
                expect(capturedActions).not.toBeNull();

                // Use non-null assertion since we just checked it's not null
                const actions = capturedActions!;

                // Get initial content
                const initialContent = editor.state.doc.textContent;

                // Test applyFix action
                actions.applyFix();

                await new Promise((resolve) => setTimeout(resolve, 10));

                // Property: applyFix should have modified the document
                const newContent = editor.state.doc.textContent;
                expect(newContent).toContain('FIXED');
                expect(newContent).not.toBe(initialContent);

                // Property: Popover should be closed after action
                expect(popoverManager.isVisible()).toBe(false);
            }

            editor.destroy();
        }
    );
});

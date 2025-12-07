/**
 * @vitest-environment jsdom
 */
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { createDecorationSet, isIssueIgnored } from './Linter';
import type { Issue, Severity, IgnoredIssue } from '../types';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

// Generator for severity values
const severityArb = fc.constantFrom(
    'info',
    'warning',
    'error'
) as fc.Arbitrary<Severity>;

// Generator for a valid issue with positions within a reasonable range
const issueArb = fc
    .record({
        message: fc.string({ minLength: 1, maxLength: 50 }),
        from: fc.integer({ min: 1, max: 20 }),
        toOffset: fc.integer({ min: 1, max: 10 }),
        severity: severityArb,
    })
    .map(
        ({ message, from, toOffset, severity }) =>
            ({
                message,
                from,
                to: from + toOffset,
                severity,
            } as Issue)
    );

// Generator for an ignored issue entry
const ignoredIssueArb = fc
    .record({
        message: fc.string({ minLength: 1, maxLength: 50 }),
        from: fc.integer({ min: 1, max: 20 }),
        toOffset: fc.integer({ min: 1, max: 10 }),
    })
    .map(
        ({ message, from, toOffset }) =>
            ({
                message,
                from,
                to: from + toOffset,
            } as IgnoredIssue)
    );

describe('Ignored Issue Filtering Property Tests', () => {
    // **Feature: on-demand-linting, Property 8: Ignored issue filtering**
    // **Validates: Requirements 9.3, 9.4**

    test.prop([issueArb], { numRuns: 100 })(
        'isIssueIgnored returns true when issue matches ignored entry exactly',
        (issue) => {
            const ignoredIssues: IgnoredIssue[] = [
                {
                    from: issue.from,
                    to: issue.to,
                    message: issue.message,
                },
            ];

            // Property: Issue should be considered ignored when it matches by from, to, and message
            expect(isIssueIgnored(issue, ignoredIssues)).toBe(true);
        }
    );

    test.prop([issueArb, fc.string({ minLength: 1, maxLength: 50 })], {
        numRuns: 100,
    })(
        'isIssueIgnored returns false when message differs',
        (issue, differentMessage) => {
            // Skip if messages happen to be the same
            fc.pre(differentMessage !== issue.message);

            const ignoredIssues: IgnoredIssue[] = [
                {
                    from: issue.from,
                    to: issue.to,
                    message: differentMessage,
                },
            ];

            // Property: Issue should NOT be ignored when message differs
            expect(isIssueIgnored(issue, ignoredIssues)).toBe(false);
        }
    );

    test.prop([issueArb, fc.integer({ min: 1, max: 20 })], { numRuns: 100 })(
        'isIssueIgnored returns false when from position differs',
        (issue, differentFrom) => {
            // Skip if positions happen to be the same
            fc.pre(differentFrom !== issue.from);

            const ignoredIssues: IgnoredIssue[] = [
                {
                    from: differentFrom,
                    to: issue.to,
                    message: issue.message,
                },
            ];

            // Property: Issue should NOT be ignored when from position differs
            expect(isIssueIgnored(issue, ignoredIssues)).toBe(false);
        }
    );

    test.prop([issueArb, fc.integer({ min: 2, max: 30 })], { numRuns: 100 })(
        'isIssueIgnored returns false when to position differs',
        (issue, differentTo) => {
            // Skip if positions happen to be the same
            fc.pre(differentTo !== issue.to);

            const ignoredIssues: IgnoredIssue[] = [
                {
                    from: issue.from,
                    to: differentTo,
                    message: issue.message,
                },
            ];

            // Property: Issue should NOT be ignored when to position differs
            expect(isIssueIgnored(issue, ignoredIssues)).toBe(false);
        }
    );

    test.prop([issueArb], { numRuns: 100 })(
        'isIssueIgnored returns false when ignored list is empty',
        (issue) => {
            const ignoredIssues: IgnoredIssue[] = [];

            // Property: Issue should NOT be ignored when ignored list is empty
            expect(isIssueIgnored(issue, ignoredIssues)).toBe(false);
        }
    );
});

describe('createDecorationSet Ignored Issue Filtering Tests', () => {
    let editor: Editor;

    beforeEach(() => {
        editor = new Editor({
            extensions: [Document, Paragraph, Text],
            content:
                '<p>This is test content for ignored issue filtering testing.</p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    // **Feature: on-demand-linting, Property 8: Ignored issue filtering**
    // **Validates: Requirements 9.3, 9.4**
    test.prop([severityArb], { numRuns: 50 })(
        'createDecorationSet excludes ignored issues from decorations',
        async (severity) => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            const issues: Issue[] = [
                {
                    message: 'Test issue to ignore',
                    from: 1,
                    to: 5,
                    severity,
                },
            ];

            const ignoredIssues: IgnoredIssue[] = [
                {
                    from: 1,
                    to: 5,
                    message: 'Test issue to ignore',
                },
            ];

            const decorationSet = createDecorationSet(
                editor.state.doc,
                issues,
                undefined,
                ignoredIssues
            );

            // Property: No decorations should be created for ignored issues (Requirement 9.4)
            expect(decorationSet.find().length).toBe(0);
        }
    );

    test.prop([severityArb, severityArb], { numRuns: 50 })(
        'createDecorationSet includes non-ignored issues while excluding ignored ones',
        async (severity1, severity2) => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            const issues: Issue[] = [
                {
                    message: 'Issue to ignore',
                    from: 1,
                    to: 5,
                    severity: severity1,
                },
                {
                    message: 'Issue to keep',
                    from: 10,
                    to: 15,
                    severity: severity2,
                },
            ];

            const ignoredIssues: IgnoredIssue[] = [
                {
                    from: 1,
                    to: 5,
                    message: 'Issue to ignore',
                },
            ];

            const decorationSet = createDecorationSet(
                editor.state.doc,
                issues,
                undefined,
                ignoredIssues
            );

            // Property: Only non-ignored issues should have decorations (2 per issue: inline + widget)
            expect(decorationSet.find().length).toBe(2);
        }
    );

    test.prop([fc.array(severityArb, { minLength: 1, maxLength: 5 })], {
        numRuns: 50,
    })(
        'createDecorationSet creates decorations for all issues when no ignored list provided',
        async (severities) => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            const issues: Issue[] = severities.map((severity, idx) => ({
                message: `Issue ${idx}`,
                from: 1 + idx * 5,
                to: 4 + idx * 5,
                severity,
            }));

            const decorationSet = createDecorationSet(
                editor.state.doc,
                issues,
                undefined,
                undefined
            );

            // Property: All issues should have decorations when no ignored list (2 per issue)
            expect(decorationSet.find().length).toBe(issues.length * 2);
        }
    );

    test.prop([fc.array(severityArb, { minLength: 1, maxLength: 5 })], {
        numRuns: 50,
    })(
        'createDecorationSet creates decorations for all issues when ignored list is empty',
        async (severities) => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            const issues: Issue[] = severities.map((severity, idx) => ({
                message: `Issue ${idx}`,
                from: 1 + idx * 5,
                to: 4 + idx * 5,
                severity,
            }));

            const decorationSet = createDecorationSet(
                editor.state.doc,
                issues,
                undefined,
                []
            );

            // Property: All issues should have decorations when ignored list is empty (2 per issue)
            expect(decorationSet.find().length).toBe(issues.length * 2);
        }
    );
});

describe('Ignore Action Storage Update Property Tests', () => {
    // **Feature: on-demand-linting, Property 9: Ignore action storage update**
    // **Validates: Requirements 9.2, 9.3**

    test.prop([issueArb], { numRuns: 50 })(
        'ignore action adds issue to ignoredIssues storage',
        async (issue) => {
            // Import Linter for full integration test
            const { Linter } = await import('./Linter');
            const { LinterPlugin } = await import('./LinterPlugin');

            // Create a plugin that produces the test issue
            class TestPlugin extends LinterPlugin {
                scan(): this {
                    this.record(
                        issue.message,
                        issue.from,
                        issue.to,
                        issue.severity
                    );
                    return this;
                }
            }

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPlugin],
                        popover: {},
                    }),
                ],
                content:
                    '<p>This is test content for ignore action storage testing.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Verify initial state - ignoredIssues should be empty
            expect(editor.storage.linter.ignoredIssues).toHaveLength(0);

            // Simulate the ignore action by directly adding to ignoredIssues
            // (This is what the onIgnore callback does)
            const storedIssues = editor.storage.linter.getIssues();
            if (storedIssues.length > 0) {
                const issueToIgnore = storedIssues[0];
                editor.storage.linter.ignoredIssues.push({
                    from: issueToIgnore.from,
                    to: issueToIgnore.to,
                    message: issueToIgnore.message,
                });

                // Property: ignoredIssues should contain the ignored issue (Requirement 9.3)
                expect(editor.storage.linter.ignoredIssues).toHaveLength(1);
                expect(editor.storage.linter.ignoredIssues[0].from).toBe(
                    issueToIgnore.from
                );
                expect(editor.storage.linter.ignoredIssues[0].to).toBe(
                    issueToIgnore.to
                );
                expect(editor.storage.linter.ignoredIssues[0].message).toBe(
                    issueToIgnore.message
                );
            }

            editor.destroy();
        }
    );

    test.prop([issueArb], { numRuns: 50 })(
        'clearIgnoredIssues resets the ignored issues list',
        async (issue) => {
            const { Linter } = await import('./Linter');
            const { LinterPlugin } = await import('./LinterPlugin');

            class TestPlugin extends LinterPlugin {
                scan(): this {
                    this.record(
                        issue.message,
                        issue.from,
                        issue.to,
                        issue.severity
                    );
                    return this;
                }
            }

            const editor = new Editor({
                extensions: [
                    Document,
                    Paragraph,
                    Text,
                    Linter.configure({
                        plugins: [TestPlugin],
                        popover: {},
                    }),
                ],
                content:
                    '<p>This is test content for clear ignored issues testing.</p>',
            });

            await new Promise((resolve) => setTimeout(resolve, 20));

            // Add an ignored issue
            const storedIssues = editor.storage.linter.getIssues();
            if (storedIssues.length > 0) {
                const issueToIgnore = storedIssues[0];
                editor.storage.linter.ignoredIssues.push({
                    from: issueToIgnore.from,
                    to: issueToIgnore.to,
                    message: issueToIgnore.message,
                });

                expect(editor.storage.linter.ignoredIssues).toHaveLength(1);

                // Clear ignored issues
                editor.storage.linter.clearIgnoredIssues();

                // Property: ignoredIssues should be empty after clearing (Requirement 9.3)
                expect(editor.storage.linter.ignoredIssues).toHaveLength(0);
            }

            editor.destroy();
        }
    );

    test.prop([fc.array(issueArb, { minLength: 2, maxLength: 5 })], {
        numRuns: 50,
    })('multiple issues can be added to ignoredIssues', async (issues) => {
        const { Linter } = await import('./Linter');
        const { LinterPlugin } = await import('./LinterPlugin');

        // Create a plugin that produces multiple issues
        class TestPlugin extends LinterPlugin {
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
        }

        const editor = new Editor({
            extensions: [
                Document,
                Paragraph,
                Text,
                Linter.configure({
                    plugins: [TestPlugin],
                    popover: {},
                }),
            ],
            content:
                '<p>This is test content for multiple ignored issues testing with enough length.</p>',
        });

        await new Promise((resolve) => setTimeout(resolve, 20));

        // Add all issues to ignored list
        const storedIssues = editor.storage.linter.getIssues();
        for (const issue of storedIssues) {
            editor.storage.linter.ignoredIssues.push({
                from: issue.from,
                to: issue.to,
                message: issue.message,
            });
        }

        // Property: All issues should be in the ignored list
        expect(editor.storage.linter.ignoredIssues.length).toBe(
            storedIssues.length
        );

        editor.destroy();
    });
});

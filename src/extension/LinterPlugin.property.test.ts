import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { LinterPlugin } from './LinterPlugin';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

// Create a minimal mock document for testing
function createMockDoc(): ProsemirrorNode {
    return {
        type: { name: 'doc' },
        content: { size: 0 },
        nodeSize: 2,
    } as unknown as ProsemirrorNode;
}

// Test subclass that exposes the protected record method
class TestLinterPlugin extends LinterPlugin {
    public recordIssue(
        message: string,
        from: number,
        to: number,
        severity?: 'info' | 'warning' | 'error',
        fix?: (view: unknown, issue: unknown) => void
    ): void {
        if (severity !== undefined) {
            this.record(message, from, to, severity, fix as never);
        } else {
            // Call record without severity to test default
            this.record(message, from, to);
        }
    }
}

// Generator for severity values
const severityArb = fc.constantFrom('info', 'warning', 'error') as fc.Arbitrary<
    'info' | 'warning' | 'error'
>;

// Generator for a single issue record input
const issueInputArb = fc.record({
    message: fc.string({ minLength: 1 }),
    from: fc.nat({ max: 1000 }),
    toOffset: fc.nat({ max: 1000 }),
    severity: severityArb,
});

describe('LinterPlugin Property Tests', () => {
    // **Feature: tiptap-linter, Property 20: Default Severity**
    // **Validates: Requirements 2.4**
    test.prop(
        [
            fc.string({ minLength: 1 }),
            fc.nat({ max: 1000 }),
            fc.nat({ max: 1000 }),
        ],
        { numRuns: 100 }
    )(
        'record() without severity parameter defaults to warning',
        (message, from, toOffset) => {
            const doc = createMockDoc();
            const plugin = new TestLinterPlugin(doc);
            const to = from + toOffset;

            // Record without specifying severity
            plugin.recordIssue(message, from, to);

            const results = plugin.getResults();

            expect(results).toHaveLength(1);
            expect(results[0].severity).toBe('warning');
            expect(results[0].message).toBe(message);
            expect(results[0].from).toBe(from);
            expect(results[0].to).toBe(to);
        }
    );

    // **Feature: tiptap-linter, Property 2: Record/GetResults Round-Trip**
    // **Validates: Requirements 3.3, 3.4**
    test.prop([fc.array(issueInputArb, { minLength: 0, maxLength: 20 })], {
        numRuns: 100,
    })(
        'record() calls produce matching Issue objects in getResults()',
        (issueInputs) => {
            const doc = createMockDoc();
            const plugin = new TestLinterPlugin(doc);

            // Record all issues
            for (const input of issueInputs) {
                const to = input.from + input.toOffset;
                plugin.recordIssue(
                    input.message,
                    input.from,
                    to,
                    input.severity
                );
            }

            const results = plugin.getResults();

            // Property: getResults() returns exactly n Issue objects
            expect(results).toHaveLength(issueInputs.length);

            // Property: Each Issue matches the corresponding record() call
            for (let i = 0; i < issueInputs.length; i++) {
                const input = issueInputs[i];
                const result = results[i];
                const expectedTo = input.from + input.toOffset;

                expect(result.message).toBe(input.message);
                expect(result.from).toBe(input.from);
                expect(result.to).toBe(expectedTo);
                expect(result.severity).toBe(input.severity);
            }
        }
    );
});

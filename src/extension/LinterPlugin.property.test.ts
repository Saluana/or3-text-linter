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
});

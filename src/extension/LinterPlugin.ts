import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { Issue, Severity, FixFn } from '../types';

/**
 * Base class for creating lint plugins that scan ProseMirror documents
 * and record issues with positions, messages, and optional fixes.
 */
export class LinterPlugin {
    protected doc: ProsemirrorNode;
    private results: Issue[] = [];

    constructor(doc: ProsemirrorNode) {
        this.doc = doc;
    }

    /**
     * Record an issue with default warning severity
     * @param message - Human-readable description of the issue
     * @param from - Start position in the document
     * @param to - End position in the document
     * @param severity - Severity level (defaults to 'warning')
     * @param fix - Optional fix function
     */
    protected record(
        message: string,
        from: number,
        to: number,
        severity: Severity = 'warning',
        fix?: FixFn
    ): void {
        this.results.push({ message, from, to, severity, fix });
    }

    /**
     * Scan the document for issues. Override in subclasses.
     * @returns this for method chaining, or Promise<this> for async plugins
     */
    scan(): this | Promise<this> {
        return this;
    }

    /**
     * Get all recorded issues
     * @returns Array of Issue objects
     */
    getResults(): Issue[] {
        return this.results;
    }
}

import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

/**
 * Severity levels for lint issues
 * - info: Informational suggestions
 * - warning: Potential problems that should be reviewed
 * - error: Critical issues that should be fixed
 */
export type Severity = 'info' | 'warning' | 'error';

/**
 * Fix function signature for automatic issue correction
 * @param view - The ProseMirror EditorView instance
 * @param issue - The Issue object containing position and context
 */
export type FixFn = (view: EditorView, issue: Issue) => void;

/**
 * Core issue interface representing a detected lint problem
 */
export interface Issue {
    /** Human-readable description of the issue */
    message: string;
    /** Start position in the document (ProseMirror position) */
    from: number;
    /** End position in the document (ProseMirror position) */
    to: number;
    /** Severity level of the issue */
    severity: Severity;
    /** Optional fix function to automatically correct the issue */
    fix?: FixFn;
}

// Forward declaration for LinterPlugin (will be implemented in LinterPlugin.ts)
export interface LinterPluginInterface {
    scan(): this | Promise<this>;
    getResults(): Issue[];
}

/**
 * Constructor type for synchronous LinterPlugin classes
 */
export type LinterPluginClass = new (
    doc: ProsemirrorNode
) => LinterPluginInterface;

/**
 * Constructor type for asynchronous AILinterPlugin classes
 */
export type AsyncLinterPluginClass = new (
    doc: ProsemirrorNode
) => LinterPluginInterface;

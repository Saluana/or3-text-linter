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

// ============================================================================
// AI Linter Plugin Types (Requirements 13.1, 14.1, 14.2, 14.3, 14.4)
// ============================================================================

/**
 * AI provider function type - user provides their own implementation
 * using OpenAI SDK, OpenRouter, Vercel AI SDK, or custom provider.
 *
 * @param prompt - The system prompt instructing the AI what to look for
 * @param content - The document text content to analyze
 * @returns Promise resolving to AIResponse with detected issues
 *
 * Requirements: 13.1, 14.1
 */
export type AIProviderFn = (
    prompt: string,
    content: string
) => Promise<AIResponse>;

/**
 * AI response interface for structured issue data from AI providers.
 *
 * Requirements: 13.3, 15.1
 */
export interface AIResponse {
    issues: Array<{
        /** Human-readable description of the issue */
        message: string;
        /** The problematic text to find in the document */
        textMatch: string;
        /** Optional replacement text for automatic fix */
        suggestion?: string;
    }>;
}

/**
 * Configuration interface for AILinterPlugin.
 *
 * Requirements: 13.1, 14.1, 14.2, 14.3, 14.4
 */
export interface AILinterPluginConfig {
    /** User-provided function that calls their chosen AI provider (Required) */
    provider: AIProviderFn;
    /** Custom system prompt for the AI (Optional - Requirement 14.2) */
    systemPrompt?: string;
    /** Debounce timing in milliseconds to limit API calls (Optional - Requirement 14.3) */
    debounceMs?: number;
    /** Default severity for issues found by this plugin (Optional) */
    severity?: Severity;
    /** What content to analyze: full document, selection, or changed ranges (Optional - Requirement 14.4) */
    contentScope?: 'full' | 'selection' | 'changed';
}

import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { Component } from 'vue';

// Forward declaration for Issue (defined below)
// This is needed for PopoverActions which references Issue

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
 * Tool definition for AI providers that support function/tool calling.
 * Compatible with OpenAI, Anthropic, and OpenRouter tool formats.
 */
export interface AITool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}

/**
 * AI provider function type - user provides their own implementation
 * using OpenAI SDK, OpenRouter, Vercel AI SDK, or custom provider.
 *
 * The provider receives tools for structured output. When tools are provided,
 * the provider should use tool/function calling for more reliable results.
 *
 * @param prompt - The system prompt instructing the AI what to look for
 * @param content - The document text content to analyze
 * @param tools - Optional tool definitions for structured output
 * @returns Promise resolving to AIResponse with detected issues
 *
 * Requirements: 13.1, 14.1
 */
export type AIProviderFn = (
    prompt: string,
    content: string,
    tools?: AITool[]
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
        /** Which occurrence of textMatch to highlight (0-indexed, default 0) */
        occurrenceIndex?: number;
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

// ============================================================================
// Popover System Types (Requirements 18.1, 18.5, 18.6, 19.1-19.5)
// ============================================================================

/**
 * Actions available to popover renderers for interacting with lint issues.
 * These actions allow custom popovers to modify the document or dismiss the popover.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */
export interface PopoverActions {
    /**
     * Apply the issue's fix function (if available) and close the popover.
     * After applying the fix, the editor will be focused.
     * Requirement: 19.1
     */
    applyFix: () => void;

    /**
     * Delete the text in the issue range and close the popover.
     * After deletion, the editor will be focused.
     * Requirement: 19.2
     */
    deleteText: () => void;

    /**
     * Replace the issue range with custom text and close the popover.
     * After replacement, the editor will be focused.
     * @param newText - The text to replace the issue range with
     * Requirement: 19.3
     */
    replaceText: (newText: string) => void;

    /**
     * Close the popover without making any changes to the document.
     * Requirement: 19.4
     */
    dismiss: () => void;
}

/**
 * Context passed to custom popover renderers.
 * Contains all information needed to render a popover and interact with issues.
 *
 * Requirements: 18.2, 18.3
 */
export interface PopoverContext {
    /** The issue(s) at this position - may contain multiple issues at same location */
    issues: Issue[];

    /** Available actions for the popover to interact with issues */
    actions: PopoverActions;

    /** The EditorView instance for advanced customization */
    view: EditorView;
}

/**
 * Custom popover renderer function type.
 * Returns an HTMLElement to display in the popover.
 *
 * Requirement: 18.1
 */
export type PopoverRenderer = (context: PopoverContext) => HTMLElement;

/**
 * Vue component configuration for popover content.
 * Provides a declarative way to render Vue components in popovers.
 */
export interface VuePopoverComponent {
    /** The Vue component to render */
    component: Component;
    /** Optional props to pass to the component (in addition to context) */
    props?: Record<string, unknown>;
}

/**
 * Popover positioning options relative to the lint icon.
 *
 * Requirement: 18.6
 */
export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * Popover styling configuration for customizing appearance.
 *
 * Requirement: 18.5
 */
export interface PopoverStyle {
    /** CSS border property (e.g., '1px solid #ccc') */
    border?: string;

    /** CSS background property (e.g., '#ffffff' or 'rgba(255,255,255,0.95)') */
    background?: string;

    /** CSS padding property (e.g., '8px 12px') */
    padding?: string;

    /** CSS border-radius property (e.g., '4px') */
    borderRadius?: string;

    /** CSS box-shadow property (e.g., '0 2px 8px rgba(0,0,0,0.15)') */
    boxShadow?: string;

    /** Offset from the icon in pixels (default: 8) */
    offset?: number;
}

/**
 * Popover configuration options for the Linter extension.
 *
 * Requirements: 18.1, 18.5, 18.6
 */
export interface PopoverOptions {
    /**
     * Custom renderer function for the popover content.
     * If not provided, a default popover will be used.
     * Requirement: 18.1
     *
     * Note: Cannot be used together with `vueComponent`.
     */
    renderer?: PopoverRenderer;

    /**
     * Vue component configuration for popover content.
     * When provided, a Vue component will be rendered instead of using the renderer.
     * The component receives the PopoverContext as props and can access popover actions
     * via Vue's inject API using the 'popoverActions' key.
     *
     * Note: Cannot be used together with `renderer`.
     */
    vueComponent?: VuePopoverComponent;

    /**
     * Popover placement relative to the lint icon.
     * Default: 'bottom'
     * Requirement: 18.6
     */
    placement?: PopoverPlacement;

    /**
     * Custom styling for the popover container.
     * Requirement: 18.5
     */
    style?: PopoverStyle;

    /**
     * Whether to show the severity indicator in the default popover.
     * Default: true
     */
    showSeverity?: boolean;

    /**
     * Whether to show the fix button when an issue has a fix function.
     * Default: true
     */
    showFixButton?: boolean;
}

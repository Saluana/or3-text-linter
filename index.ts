/**
 * Tiptap Linter Extension
 *
 * A comprehensive linting solution for Tiptap/ProseMirror editors.
 * Provides configurable lint plugins, AI-powered linting, and natural language rules.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
    // Issue and severity types
    Severity,
    FixFn,
    Issue,

    // Plugin class types
    LinterPluginInterface,
    LinterPluginClass,
    AsyncLinterPluginClass,

    // AI plugin types
    AITool,
    AIProviderFn,
    AIResponse,
    AILinterPluginConfig,

    // Popover system types (Requirements 18.1, 18.5, 18.6, 19.1-19.5)
    PopoverActions,
    PopoverContext,
    PopoverRenderer,
    PopoverPlacement,
    PopoverStyle,
    PopoverOptions,
    VuePopoverComponent,
} from './src/types';

// ============================================================================
// Linter Extension
// ============================================================================

export {
    Linter,
    renderIcon,
    runAllLinterPlugins,
    createDecorationSet,
} from './src/extension/Linter';

export type {
    LinterOptions,
    LinterStorage,
    IconDivElement,
} from './src/extension/Linter';

// ============================================================================
// Base Plugin Classes
// ============================================================================

export { LinterPlugin } from './src/extension/LinterPlugin';

export { AILinterPlugin } from './src/extension/AILinterPlugin';

export type {
    TextSegment,
    TextExtractionResult,
} from './src/extension/AILinterPlugin';

// ============================================================================
// Natural Language Rule Factory
// ============================================================================

export { createNaturalLanguageRule } from './src/factory/createNaturalLanguageRule';

export type { NaturalLanguageRuleConfig } from './src/factory/createNaturalLanguageRule';

// ============================================================================
// Popover System
// ============================================================================

export {
    PopoverManager,
    createDefaultPopover,
} from './src/extension/PopoverManager';

export {
    usePopoverActions,
    usePopoverContext,
} from './src/extension/usePopover';

// ============================================================================
// Built-in Plugins
// ============================================================================

export { BadWords } from './src/extension/plugins/BadWords';
export { Punctuation } from './src/extension/plugins/Punctuation';
export { HeadingLevel } from './src/extension/plugins/HeadingLevel';

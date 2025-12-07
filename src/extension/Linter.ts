import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type {
    Issue,
    LinterPluginClass,
    AsyncLinterPluginClass,
    PopoverOptions,
    PluginConfig,
    CustomSeverity,
    RunRuleOptions,
    IgnoredIssue,
} from '../types';
import { PopoverManager, type OnIgnoreCallback } from './PopoverManager';
import { AILinterPlugin } from './AILinterPlugin';

/**
 * ID for the custom severity CSS style element
 */
const CUSTOM_SEVERITY_STYLE_ID = 'linter-custom-severities';

/**
 * Generate CSS for custom severity levels.
 * Creates CSS classes for both inline highlights (.problem--{name}) and
 * lint icons (.lint-icon--{name}) using the specified color.
 *
 * Requirements: 8.2, 8.3, 8.4
 *
 * @param customSeverities - Array of CustomSeverity definitions
 * @returns CSS string with all custom severity styles
 */
export function generateCustomSeverityCSS(
    customSeverities: CustomSeverity[]
): string {
    if (!customSeverities || customSeverities.length === 0) {
        return '';
    }

    return customSeverities
        .map((severity) => {
            const { name, color } = severity;
            // Generate CSS for inline highlight with underline
            const problemCSS = `.problem--${name} { background-color: ${color}20; border-bottom: 2px solid ${color}; }`;
            // Generate CSS for lint icon with background color
            const iconCSS = `.lint-icon--${name} { background-color: ${color}; }`;
            return `${problemCSS}\n${iconCSS}`;
        })
        .join('\n');
}

/**
 * Inject custom severity CSS into the document head.
 * Creates or updates a style element with the generated CSS.
 *
 * Requirements: 8.2
 *
 * @param customSeverities - Array of CustomSeverity definitions
 */
export function injectCustomSeverityCSS(
    customSeverities: CustomSeverity[] | undefined
): void {
    // Remove existing style element if present
    const existingStyle = document.getElementById(CUSTOM_SEVERITY_STYLE_ID);
    if (existingStyle) {
        existingStyle.remove();
    }

    // Only inject if there are custom severities
    if (!customSeverities || customSeverities.length === 0) {
        return;
    }

    const css = generateCustomSeverityCSS(customSeverities);
    if (!css) {
        return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = CUSTOM_SEVERITY_STYLE_ID;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
}

/**
 * Remove custom severity CSS from the document head.
 * Called during extension cleanup.
 */
export function removeCustomSeverityCSS(): void {
    const existingStyle = document.getElementById(CUSTOM_SEVERITY_STYLE_ID);
    if (existingStyle) {
        existingStyle.remove();
    }
}

/**
 * Normalized plugin representation with explicit mode setting.
 * Used internally to handle both direct plugin classes and PluginConfig objects uniformly.
 *
 * Requirements: 7.2
 */
export interface NormalizedPlugin {
    /** The plugin class to instantiate */
    pluginClass: LinterPluginClass | AsyncLinterPluginClass;
    /** Execution mode: 'auto' runs on document changes, 'onDemand' requires manual trigger */
    mode: 'auto' | 'onDemand';
}

/**
 * Check if a value is a PluginConfig object (has a 'plugin' property)
 * @param value - The value to check
 * @returns true if value is a PluginConfig object
 */
function isPluginConfig(
    value: LinterPluginClass | AsyncLinterPluginClass | PluginConfig
): value is PluginConfig {
    return (
        typeof value === 'object' &&
        value !== null &&
        'plugin' in value &&
        typeof (value as PluginConfig).plugin === 'function'
    );
}

/**
 * Normalize an array of mixed plugin classes and PluginConfig objects
 * into a uniform array of NormalizedPlugin objects.
 *
 * This function handles both:
 * - Direct plugin class references (backward compatible): [BadWords, Punctuation]
 * - Configuration objects: [{ plugin: BadWords, mode: 'auto' }, { plugin: AIGrammar, mode: 'onDemand' }]
 *
 * @param plugins - Mixed array of plugin classes and PluginConfig objects
 * @returns Array of NormalizedPlugin with pluginClass and mode
 *
 * Requirements: 7.2
 */
export function normalizePlugins(
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass | PluginConfig>
): NormalizedPlugin[] {
    return plugins.map((plugin) => {
        if (isPluginConfig(plugin)) {
            return {
                pluginClass: plugin.plugin,
                mode: plugin.mode ?? 'auto',
            };
        }
        // Direct plugin class - default mode to 'auto'
        return {
            pluginClass: plugin,
            mode: 'auto',
        };
    });
}

/**
 * Extended HTMLDivElement interface for lint icons with attached issue data
 */
export interface IconDivElement extends HTMLDivElement {
    issue?: Issue;
}

/**
 * Render a lint icon element with severity-based styling and accessibility attributes
 * @param issue - The Issue object to render an icon for
 * @returns IconDivElement with attached issue data
 */
export function renderIcon(issue: Issue): IconDivElement {
    const icon = document.createElement('div') as IconDivElement;
    icon.className = `lint-icon lint-icon--${issue.severity}`;
    icon.title = issue.message;
    icon.issue = issue;
    icon.setAttribute('role', 'button');
    icon.setAttribute('aria-label', `Lint issue: ${issue.message}`);
    return icon;
}

/**
 * Options for the Linter extension
 *
 * Requirements: 6.1, 7.1, 8.1, 18.1, 18.5, 18.6
 */
export interface LinterOptions {
    /** Array of linter plugin classes or plugin configurations to run on the document */
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass | PluginConfig>;

    /**
     * Popover configuration options.
     * When provided, clicking a lint icon will show a popover instead of selecting text.
     * Requirements: 18.1, 18.5, 18.6
     */
    popover?: PopoverOptions;

    /**
     * Whether to run plugins automatically on document changes.
     * When false, plugins will only run when explicitly triggered via runRule.
     * Default: true
     * Requirement: 6.1
     */
    autoLint?: boolean;

    /**
     * Custom severity definitions beyond the built-in info/warning/error levels.
     * Each severity has a name and color for styling decorations.
     * Requirement: 8.1
     */
    customSeverities?: CustomSeverity[];
}

/**
 * Storage interface for accessing issues programmatically
 */
export interface LinterStorage {
    issues: Issue[];
    getIssues(): Issue[];
    /** PopoverManager instance for programmatic popover control */
    popoverManager: PopoverManager | null;
    /** Debounce timer for async plugin runs */
    asyncDebounceTimer: ReturnType<typeof setTimeout> | null;
    /** Flag to prevent multiple initial async runs */
    hasScheduledInitialRun: boolean;
    /** Last document text content hash to detect actual changes */
    lastDocContentHash: string | null;
    /**
     * Run a specific plugin on-demand and return its issues.
     * Works with both sync (LinterPlugin) and async (AILinterPlugin) plugins.
     *
     * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.2
     *
     * @param pluginClass - The plugin class to execute
     * @param options - Optional configuration for the run
     * @returns Promise resolving to array of issues from the plugin
     */
    runRule: (
        pluginClass: LinterPluginClass | AsyncLinterPluginClass,
        options?: RunRuleOptions
    ) => Promise<Issue[]>;
    /**
     * List of ignored issues that won't be displayed.
     * Issues are matched by position (from, to) and message.
     *
     * Requirement: 9.3
     */
    ignoredIssues: IgnoredIssue[];
    /**
     * Clear all ignored issues, allowing them to be displayed again.
     *
     * Requirement: 9.3
     */
    clearIgnoredIssues: () => void;
}

/**
 * Run all linter plugins (sync and async) and create a DecorationSet
 *
 * This function handles both synchronous and asynchronous plugins:
 * - Sync plugins: scan() returns `this`
 * - Async plugins: scan() returns `Promise<this>`
 *
 * All plugins run concurrently using Promise.allSettled to ensure:
 * - Editor remains responsive during async operations (Requirement 12.2)
 * - Multiple async plugins run concurrently (Requirement 12.3)
 * - Errors in one plugin don't affect others (Requirement 12.4)
 *
 * @param doc - The ProseMirror document to scan
 * @param plugins - Array of plugin classes to run
 * @returns Promise resolving to object with DecorationSet and issues array
 */
export async function runAllLinterPlugins(
    doc: ProsemirrorNode,
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass>
): Promise<{ decorations: DecorationSet; issues: Issue[] }> {
    // Run all plugins concurrently (Requirement 12.3)
    // Each plugin is wrapped in its own async function to handle both sync and async scan()
    const pluginPromises = plugins.map(async (PluginClass) => {
        const plugin = new PluginClass(doc);
        const result = plugin.scan();

        // Detect if scan() returns Promise and await it (Requirement 12.1)
        if (result instanceof Promise) {
            await result;
        }

        return plugin.getResults();
    });

    // Use Promise.allSettled to catch errors and continue with other plugins (Requirement 12.4)
    const results = await Promise.allSettled(pluginPromises);

    // Merge sync and async results, collecting issues from successful plugins only
    const allIssues: Issue[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allIssues.push(...result.value);
        } else {
            // Log errors but continue processing (Requirement 12.4)
            if (process.env.NODE_ENV !== 'production') {
                console.error('[Tiptap Linter] Plugin failed:', result.reason);
            }
        }
    }

    return {
        decorations: createDecorationSet(doc, allIssues),
        issues: allIssues,
    };
}

const linterPluginKey = new PluginKey('linter');

/**
 * Linter Tiptap extension that runs configurable lint plugins
 * and manages decorations for detected issues.
 */
export const Linter = Extension.create<LinterOptions, LinterStorage>({
    name: 'linter',

    addOptions() {
        return {
            plugins: [],
        };
    },

    addStorage() {
        return {
            issues: [] as Issue[],
            getIssues() {
                return this.issues;
            },
            popoverManager: null as PopoverManager | null,
            asyncDebounceTimer: null as ReturnType<typeof setTimeout> | null,
            hasScheduledInitialRun: false,
            lastDocContentHash: null as string | null,
            // runRule is initialized in onCreate when editor is available
            runRule: (() => {
                throw new Error('runRule not initialized - editor not ready');
            }) as LinterStorage['runRule'],
            // Ignored issues list - issues matching by position and message won't be displayed
            // Requirement: 9.3
            ignoredIssues: [] as IgnoredIssue[],
            clearIgnoredIssues() {
                this.ignoredIssues = [];
            },
        };
    },

    onCreate() {
        // Inject custom severity CSS on initialization (Requirement 8.2)
        injectCustomSeverityCSS(this.options.customSeverities);

        // Set up runRule method now that editor is available
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const extension = this;
        const storage = this.storage;

        /**
         * Run a specific plugin on-demand and return its issues.
         * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.2
         */
        storage.runRule = async function (
            pluginClass: LinterPluginClass | AsyncLinterPluginClass,
            options?: RunRuleOptions
        ): Promise<Issue[]> {
            // Validate plugin class (Requirement 2.3)
            if (typeof pluginClass !== 'function') {
                throw new Error(
                    'Invalid plugin class: must be a LinterPlugin or AILinterPlugin subclass'
                );
            }

            const editor = extension.editor;
            if (!editor) {
                throw new Error('Editor not available');
            }

            const doc = editor.state.doc;
            const docSize = doc.content.size;

            // Execute the plugin
            const plugin = new pluginClass(doc);
            const result = plugin.scan();

            // Detect async plugin and await if needed (Requirements 1.2, 1.3, 2.1, 2.2)
            if (result instanceof Promise) {
                await result;
            }

            // Get issues and filter out invalid ones (Requirement 5.3)
            const rawIssues = plugin.getResults();
            const validIssues = rawIssues.filter((issue) => {
                // Filter out issues with invalid positions
                if (issue.from < 0) return false;
                if (issue.to > docSize) return false;
                if (issue.from >= issue.to) return false;
                return true;
            });

            // Apply results if requested (Requirements 3.1, 3.2, 3.3)
            if (options?.applyResults) {
                // Update stored issues with only this rule's issues
                storage.issues = validIssues;

                // Dispatch transaction with metadata to trigger decoration update
                const tr = editor.state.tr.setMeta('linterAsyncUpdate', true);
                editor.view.dispatch(tr);
            }

            // Return issues without modifying state (Requirement 1.4, 3.2)
            return validIssues;
        };
    },

    onDestroy() {
        // Clean up debounce timer to prevent accessing destroyed editor
        if (this.storage.asyncDebounceTimer) {
            clearTimeout(this.storage.asyncDebounceTimer);
            this.storage.asyncDebounceTimer = null;
        }
        // Clean up PopoverManager when extension is destroyed to prevent memory leaks
        if (this.storage.popoverManager) {
            this.storage.popoverManager.hide();
            this.storage.popoverManager = null;
        }
        // Clean up custom severity CSS (Requirement 8.2)
        removeCustomSeverityCSS();
    },

    addProseMirrorPlugins() {
        const extension = this;
        let asyncRunId = 0; // Track async runs to avoid stale updates
        let isAsyncRunning = false; // Prevent concurrent async runs
        const ASYNC_DEBOUNCE_MS = 2000; // Debounce async plugins by 2 seconds

        // Check if autoLint is enabled (default: true)
        // Requirements: 6.1, 6.4
        const isAutoLintEnabled = () => extension.options.autoLint !== false;

        // Deduplicate issues by position (keep first occurrence at each position)
        const deduplicateIssues = (issues: Issue[]): Issue[] => {
            const seen = new Set<string>();
            return issues.filter((issue) => {
                const key = `${issue.from}-${issue.to}`;
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });
        };

        // Helper to run async plugins and update decorations
        const runAsyncPluginsAndUpdate = async (runId: number) => {
            // Prevent concurrent runs
            if (isAsyncRunning) return;
            if (!extension.editor) return;

            // Skip if autoLint is disabled (Requirement 6.1)
            if (!isAutoLintEnabled()) return;

            isAsyncRunning = true;
            try {
                const doc = extension.editor.state.doc;
                const asyncIssues = await runAsyncPlugins(
                    doc,
                    extension.options.plugins
                );

                // Only update if this is still the latest run and editor exists
                if (runId === asyncRunId && extension.editor) {
                    // Merge with current sync issues and deduplicate
                    const currentSyncIssues = runSyncPlugins(
                        extension.editor.state.doc,
                        extension.options.plugins
                    );
                    const allIssues = deduplicateIssues([
                        ...currentSyncIssues,
                        ...asyncIssues,
                    ]);
                    extension.storage.issues = allIssues;

                    // Force decoration update by dispatching a metadata transaction
                    const tr = extension.editor.state.tr.setMeta(
                        'linterAsyncUpdate',
                        true
                    );
                    extension.editor.view.dispatch(tr);
                }
            } finally {
                isAsyncRunning = false;
            }
        };

        // Simple hash function for document content
        const hashContent = (content: string): string => {
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
                const char = content.charCodeAt(i);
                hash = (hash << 5) - hash + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash.toString();
        };

        // Debounced version to prevent excessive API calls
        const scheduleAsyncRun = (isInitial = false) => {
            // Skip if autoLint is disabled (Requirement 6.1)
            if (!isAutoLintEnabled()) return;

            // Prevent multiple initial runs (e.g., from HMR)
            if (isInitial && extension.storage.hasScheduledInitialRun) {
                return;
            }
            if (isInitial) {
                extension.storage.hasScheduledInitialRun = true;
            }

            if (extension.storage.asyncDebounceTimer) {
                clearTimeout(extension.storage.asyncDebounceTimer);
            }
            asyncRunId++;
            const currentRunId = asyncRunId;
            extension.storage.asyncDebounceTimer = setTimeout(() => {
                // Check if document content actually changed before running async plugins
                if (extension.editor) {
                    const currentHash = hashContent(
                        extension.editor.state.doc.textContent
                    );
                    if (extension.storage.lastDocContentHash === currentHash) {
                        // Content hasn't changed, skip async run
                        return;
                    }
                    extension.storage.lastDocContentHash = currentHash;
                }
                void runAsyncPluginsAndUpdate(currentRunId);
            }, ASYNC_DEBOUNCE_MS);
        };

        return [
            new Plugin({
                key: linterPluginKey,
                state: {
                    init: (_, state) => {
                        // When autoLint is false, skip plugin execution and return empty decorations
                        // Requirements: 6.1, 6.2
                        if (!isAutoLintEnabled()) {
                            extension.storage.issues = [];
                            return DecorationSet.empty;
                        }

                        // Run sync plugins immediately for initial state
                        const issues = runSyncPlugins(
                            state.doc,
                            extension.options.plugins
                        );
                        extension.storage.issues = issues;

                        // Schedule async plugins (debounced, marked as initial to prevent HMR duplicates)
                        scheduleAsyncRun(true);

                        return createDecorationSet(
                            state.doc,
                            issues,
                            extension.options.customSeverities,
                            extension.storage.ignoredIssues
                        );
                    },
                    apply: (tr, oldDecorations, _oldState, newState) => {
                        // Handle async update - rebuild decorations from storage
                        if (tr.getMeta('linterAsyncUpdate')) {
                            return createDecorationSet(
                                newState.doc,
                                extension.storage.issues,
                                extension.options.customSeverities,
                                extension.storage.ignoredIssues
                            );
                        }

                        // Reuse DecorationSet when document hasn't changed (Requirement 1.3)
                        if (!tr.docChanged) {
                            return oldDecorations;
                        }

                        // When autoLint is false, skip plugin execution and preserve empty state
                        // Requirements: 6.1, 6.2
                        if (!isAutoLintEnabled()) {
                            return DecorationSet.empty;
                        }

                        // Check if this is a linter fix - skip async re-run to save API calls
                        const isLinterFix = tr.getMeta('linterFix');

                        // Get fresh sync issues
                        const syncIssues = runSyncPlugins(
                            newState.doc,
                            extension.options.plugins
                        );

                        if (isLinterFix) {
                            // Cancel any pending async run to prevent wasting API calls
                            if (extension.storage.asyncDebounceTimer) {
                                clearTimeout(
                                    extension.storage.asyncDebounceTimer
                                );
                                extension.storage.asyncDebounceTimer = null;
                            }
                            // For linter fixes: keep existing async issues but adjust positions
                            // and remove issues that were directly affected by the fix
                            const existingAsyncIssues: Issue[] = [];

                            // Get the ranges that were modified by this transaction
                            const modifiedRanges: Array<{
                                from: number;
                                to: number;
                            }> = [];
                            tr.steps.forEach((_step, i) => {
                                const map = tr.mapping.maps[i];
                                map.forEach(
                                    (oldStart: number, oldEnd: number) => {
                                        modifiedRanges.push({
                                            from: oldStart,
                                            to: oldEnd,
                                        });
                                    }
                                );
                            });

                            for (const issue of extension.storage.issues) {
                                // Check if this issue overlaps with any modified range
                                const wasModified = modifiedRanges.some(
                                    (range) =>
                                        issue.from < range.to &&
                                        issue.to > range.from
                                );
                                if (wasModified) continue;

                                // Map positions to new document
                                const newFrom = tr.mapping.map(issue.from);
                                const newTo = tr.mapping.map(issue.to);

                                // Skip if positions are invalid
                                if (newFrom >= newTo) continue;
                                if (newTo > newState.doc.content.size) continue;

                                // Create a new issue object with updated positions
                                existingAsyncIssues.push({
                                    ...issue,
                                    from: newFrom,
                                    to: newTo,
                                });
                            }

                            const allIssues = deduplicateIssues([
                                ...syncIssues,
                                ...existingAsyncIssues,
                            ]);
                            extension.storage.issues = allIssues;
                            return createDecorationSet(
                                newState.doc,
                                allIssues,
                                extension.options.customSeverities,
                                extension.storage.ignoredIssues
                            );
                        }

                        // Normal edit: run async plugins after debounce
                        extension.storage.issues = syncIssues;
                        scheduleAsyncRun();
                        return createDecorationSet(
                            newState.doc,
                            syncIssues,
                            extension.options.customSeverities,
                            extension.storage.ignoredIssues
                        );
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                    handleClick: (view, _pos, event) => {
                        // Create PopoverManager lazily on first click if popover is enabled
                        if (extension.options.popover !== undefined) {
                            if (!extension.storage.popoverManager) {
                                // Create onIgnore callback to add issues to ignored list
                                // Requirements: 9.2, 9.5
                                const onIgnore: OnIgnoreCallback = (issues) => {
                                    // Add each issue to the ignored list
                                    for (const issue of issues) {
                                        extension.storage.ignoredIssues.push({
                                            from: issue.from,
                                            to: issue.to,
                                            message: issue.message,
                                        });
                                    }
                                    // Trigger decoration update to remove ignored issues
                                    const tr =
                                        extension.editor.state.tr.setMeta(
                                            'linterAsyncUpdate',
                                            true
                                        );
                                    extension.editor.view.dispatch(tr);
                                };
                                extension.storage.popoverManager =
                                    new PopoverManager(
                                        view,
                                        extension.options.popover,
                                        onIgnore
                                    );
                            }
                            return handleClickWithPopover(
                                view,
                                event,
                                extension.storage.popoverManager,
                                extension.storage.issues
                            );
                        }
                        // Fall back to legacy behavior (select text) when popover is not configured
                        return handleClickLegacy(view, event);
                    },
                    // handleDoubleClick removed - replaced by popover actions (Requirements 8.1, 8.2, 8.3)
                },
            }),
        ];
    },
});

/**
 * Check if a plugin class is async by inspecting its prototype chain.
 * Async plugins extend AILinterPlugin which has an async scan() method.
 * Uses isPrototypeOf which survives minification (unlike constructor.name).
 */
function isAsyncPlugin(
    PluginClass: LinterPluginClass | AsyncLinterPluginClass
): boolean {
    return AILinterPlugin.isPrototypeOf(PluginClass);
}

/**
 * Extract plugin class from a mixed plugin entry (either direct class or PluginConfig)
 * @param plugin - Plugin class or PluginConfig object
 * @returns The plugin class
 */
function extractPluginClass(
    plugin: LinterPluginClass | AsyncLinterPluginClass | PluginConfig
): LinterPluginClass | AsyncLinterPluginClass {
    if (isPluginConfig(plugin)) {
        return plugin.plugin;
    }
    return plugin;
}

/**
 * Get the mode for a plugin entry.
 * Returns 'auto' for direct plugin classes, or the configured mode for PluginConfig objects.
 *
 * @param pluginEntry - Plugin class or PluginConfig object
 * @returns The plugin mode ('auto' or 'onDemand')
 */
function getPluginMode(
    pluginEntry: LinterPluginClass | AsyncLinterPluginClass | PluginConfig
): 'auto' | 'onDemand' {
    if (isPluginConfig(pluginEntry)) {
        return pluginEntry.mode ?? 'auto';
    }
    return 'auto';
}

/**
 * Run all sync linter plugins and collect issues.
 * Only runs plugins with mode 'auto' or undefined (default).
 * Skips plugins with mode 'onDemand'.
 *
 * Requirements: 7.1, 7.2
 *
 * @param doc - The ProseMirror document to scan
 * @param plugins - Array of plugin classes or PluginConfig objects to run
 * @returns Array of issues from all plugins
 */
function runSyncPlugins(
    doc: ProsemirrorNode,
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass | PluginConfig>
): Issue[] {
    const allIssues: Issue[] = [];

    for (const pluginEntry of plugins) {
        // Skip plugins with mode 'onDemand' - they should only run via runRule
        // Requirements: 7.1, 7.2
        const mode = getPluginMode(pluginEntry);
        if (mode === 'onDemand') {
            continue;
        }

        const PluginClass = extractPluginClass(pluginEntry);

        // Skip async plugins entirely - don't even instantiate them
        // This prevents the async scan() from being called
        if (isAsyncPlugin(PluginClass)) {
            continue;
        }

        try {
            const plugin = new PluginClass(doc);
            const result = plugin.scan();

            // Double-check: skip if scan() returned a Promise anyway
            if (result instanceof Promise) {
                continue;
            }

            allIssues.push(...plugin.getResults());
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error(
                    `[Tiptap Linter] Plugin ${PluginClass.name} failed:`,
                    error
                );
            }
        }
    }

    return allIssues;
}

/**
 * Run all async linter plugins and collect issues.
 * Only runs plugins with mode 'auto' or undefined (default).
 * Skips plugins with mode 'onDemand'.
 *
 * Requirements: 7.1, 7.2
 *
 * @param doc - The ProseMirror document to scan
 * @param plugins - Array of plugin classes or PluginConfig objects to run
 * @returns Promise resolving to array of issues from async plugins only
 */
async function runAsyncPlugins(
    doc: ProsemirrorNode,
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass | PluginConfig>
): Promise<Issue[]> {
    const asyncPromises: Promise<Issue[]>[] = [];

    for (const pluginEntry of plugins) {
        // Skip plugins with mode 'onDemand' - they should only run via runRule
        // Requirements: 7.1, 7.2
        const mode = getPluginMode(pluginEntry);
        if (mode === 'onDemand') {
            continue;
        }

        const PluginClass = extractPluginClass(pluginEntry);

        try {
            const plugin = new PluginClass(doc);
            const result = plugin.scan();

            // Only process async plugins
            if (result instanceof Promise) {
                asyncPromises.push(
                    result
                        .then(() => plugin.getResults())
                        .catch((error) => {
                            if (process.env.NODE_ENV !== 'production') {
                                console.error(
                                    `[Tiptap Linter] Async plugin ${PluginClass.name} failed:`,
                                    error
                                );
                            }
                            return [];
                        })
                );
            }
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error(
                    `[Tiptap Linter] Plugin ${PluginClass.name} failed to initialize:`,
                    error
                );
            }
        }
    }

    if (asyncPromises.length === 0) {
        return [];
    }

    const results = await Promise.all(asyncPromises);
    return results.flat();
}

/** Built-in severity levels that have predefined CSS */
const BUILTIN_SEVERITIES = new Set(['info', 'warning', 'error']);

/**
 * Get the effective severity class name for an issue.
 * Falls back to 'warning' for unregistered custom severities.
 *
 * Requirements: 8.5
 *
 * @param severity - The issue severity
 * @param registeredCustomSeverities - Set of registered custom severity names
 * @returns The severity name to use for CSS classes
 */
export function getEffectiveSeverity(
    severity: string,
    registeredCustomSeverities: Set<string>
): string {
    // Built-in severities are always valid
    if (BUILTIN_SEVERITIES.has(severity)) {
        return severity;
    }
    // Custom severities are valid if registered
    if (registeredCustomSeverities.has(severity)) {
        return severity;
    }
    // Fall back to warning for unregistered severities (Requirement 8.5)
    return 'warning';
}

/**
 * Check if an issue matches an ignored issue entry.
 * Issues are matched by position (from, to) and message.
 *
 * Requirement: 9.4
 *
 * @param issue - The issue to check
 * @param ignoredIssue - The ignored issue entry to match against
 * @returns true if the issue matches the ignored entry
 */
export function isIssueIgnored(
    issue: Issue,
    ignoredIssues: IgnoredIssue[]
): boolean {
    return ignoredIssues.some(
        (ignored) =>
            ignored.from === issue.from &&
            ignored.to === issue.to &&
            ignored.message === issue.message
    );
}

/**
 * Create a DecorationSet from an array of issues
 * @param doc - The ProseMirror document
 * @param issues - Array of issues to create decorations for
 * @param customSeverities - Optional array of registered custom severities
 * @param ignoredIssues - Optional array of ignored issues to filter out
 * @returns DecorationSet with inline and widget decorations
 */
export function createDecorationSet(
    doc: ProsemirrorNode,
    issues: Issue[],
    customSeverities?: CustomSeverity[],
    ignoredIssues?: IgnoredIssue[]
): DecorationSet {
    const decorations: Decoration[] = [];
    const docSize = doc.content.size;

    // Build set of registered custom severity names for quick lookup
    const registeredCustomSeverities = new Set(
        customSeverities?.map((s) => s.name) ?? []
    );

    // Build ignored issues list for filtering (Requirement 9.4)
    const ignoredList = ignoredIssues ?? [];

    for (const issue of issues) {
        // Validate issue positions are within document bounds
        if (issue.from < 0 || issue.to > docSize || issue.from >= issue.to) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[Tiptap Linter] Invalid issue position:', issue);
            }
            continue;
        }

        // Skip ignored issues (Requirement 9.4)
        if (isIssueIgnored(issue, ignoredList)) {
            continue;
        }

        // Get effective severity, falling back to warning for unregistered severities (Requirement 8.5)
        const effectiveSeverity = getEffectiveSeverity(
            issue.severity,
            registeredCustomSeverities
        );

        // Create inline decoration with severity class (Requirements 1.4, 9.1, 8.5)
        decorations.push(
            Decoration.inline(issue.from, issue.to, {
                class: `problem problem--${effectiveSeverity}`,
            })
        );

        // Create widget decoration with icon (Requirement 1.5)
        // Note: renderIcon uses the original severity for the icon, but we use effective severity for styling
        const iconIssue =
            effectiveSeverity !== issue.severity
                ? { ...issue, severity: effectiveSeverity }
                : issue;
        decorations.push(
            Decoration.widget(issue.from, () => renderIcon(iconIssue), {
                side: -1,
            })
        );
    }

    return DecorationSet.create(doc, decorations);
}

/**
 * Handle click on lint icons with popover support - show popover with issue details
 * Requirements: 8.1, 8.2, 8.3, 8.5
 *
 * @param view - The EditorView
 * @param event - The mouse event
 * @param popoverManager - The PopoverManager instance
 * @param allIssues - All issues in the document (to find issues at same position)
 * @returns true if the click was handled, false otherwise
 */
function handleClickWithPopover(
    _view: EditorView,
    event: MouseEvent,
    popoverManager: PopoverManager,
    allIssues: Issue[]
): boolean {
    const target = event.target as HTMLElement;

    // Use closest() to find lint-icon element (Requirement 8.5)
    const element = target.closest('.lint-icon');
    if (!element) {
        return false;
    }
    const icon = element as IconDivElement;

    // Retrieve issue from icon element's attached data
    const clickedIssue = icon.issue;
    if (!clickedIssue) {
        return false;
    }

    // Find all issues at the same position (Requirement 18.7 - multiple issues at same position)
    const issuesAtPosition = allIssues.filter(
        (issue) =>
            issue.from === clickedIssue.from && issue.to === clickedIssue.to
    );

    // If no issues found at position, use the clicked issue
    const issuesToShow =
        issuesAtPosition.length > 0 ? issuesAtPosition : [clickedIssue];

    // Show popover positioned near the icon (Requirements 8.1, 8.2)
    popoverManager.show(issuesToShow, icon);

    return true;
}

/**
 * Legacy click handler - select the issue text range (used when popover is not configured)
 * @param view - The EditorView
 * @param event - The mouse event
 * @returns true if the click was handled, false otherwise
 */
function handleClickLegacy(view: EditorView, event: MouseEvent): boolean {
    const target = event.target as HTMLElement;

    // Use closest() to find lint-icon element
    const element = target.closest('.lint-icon');
    if (!element) {
        return false;
    }
    const icon = element as IconDivElement;

    // Retrieve issue from icon element's attached data
    const issue = icon.issue;
    if (!issue) {
        return false;
    }

    // Create TextSelection from issue.from/to and scroll into view
    const { from, to } = issue;
    const tr = view.state.tr.setSelection(
        TextSelection.create(view.state.doc, from, to)
    );
    view.dispatch(tr.scrollIntoView());

    return true;
}

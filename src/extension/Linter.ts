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
} from '../types';
import { PopoverManager } from './PopoverManager';
import { AILinterPlugin } from './AILinterPlugin';

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
 * Requirements: 18.1, 18.5, 18.6
 */
export interface LinterOptions {
    /** Array of linter plugin classes to run on the document */
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass>;

    /**
     * Popover configuration options.
     * When provided, clicking a lint icon will show a popover instead of selecting text.
     * Requirements: 18.1, 18.5, 18.6
     */
    popover?: PopoverOptions;
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
    },

    addProseMirrorPlugins() {
        const extension = this;
        let asyncRunId = 0; // Track async runs to avoid stale updates
        let isAsyncRunning = false; // Prevent concurrent async runs
        const ASYNC_DEBOUNCE_MS = 2000; // Debounce async plugins by 2 seconds

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
                        // Run sync plugins immediately for initial state
                        const issues = runSyncPlugins(
                            state.doc,
                            extension.options.plugins
                        );
                        extension.storage.issues = issues;

                        // Schedule async plugins (debounced, marked as initial to prevent HMR duplicates)
                        scheduleAsyncRun(true);

                        return createDecorationSet(state.doc, issues);
                    },
                    apply: (tr, oldDecorations, _oldState, newState) => {
                        // Handle async update - rebuild decorations from storage
                        if (tr.getMeta('linterAsyncUpdate')) {
                            return createDecorationSet(
                                newState.doc,
                                extension.storage.issues
                            );
                        }

                        // Reuse DecorationSet when document hasn't changed (Requirement 1.3)
                        if (!tr.docChanged) {
                            return oldDecorations;
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
                            return createDecorationSet(newState.doc, allIssues);
                        }

                        // Normal edit: run async plugins after debounce
                        extension.storage.issues = syncIssues;
                        scheduleAsyncRun();
                        return createDecorationSet(newState.doc, syncIssues);
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
                                extension.storage.popoverManager =
                                    new PopoverManager(
                                        view,
                                        extension.options.popover
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
 * Run all sync linter plugins and collect issues
 * @param doc - The ProseMirror document to scan
 * @param plugins - Array of plugin classes to run
 * @returns Array of issues from all plugins
 */
function runSyncPlugins(
    doc: ProsemirrorNode,
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass>
): Issue[] {
    const allIssues: Issue[] = [];

    for (const PluginClass of plugins) {
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
 * Run all async linter plugins and collect issues
 * @param doc - The ProseMirror document to scan
 * @param plugins - Array of plugin classes to run
 * @returns Promise resolving to array of issues from async plugins only
 */
async function runAsyncPlugins(
    doc: ProsemirrorNode,
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass>
): Promise<Issue[]> {
    const asyncPromises: Promise<Issue[]>[] = [];

    for (const PluginClass of plugins) {
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

/**
 * Create a DecorationSet from an array of issues
 * @param doc - The ProseMirror document
 * @param issues - Array of issues to create decorations for
 * @returns DecorationSet with inline and widget decorations
 */
export function createDecorationSet(
    doc: ProsemirrorNode,
    issues: Issue[]
): DecorationSet {
    const decorations: Decoration[] = [];
    const docSize = doc.content.size;

    for (const issue of issues) {
        // Validate issue positions are within document bounds
        if (issue.from < 0 || issue.to > docSize || issue.from >= issue.to) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[Tiptap Linter] Invalid issue position:', issue);
            }
            continue;
        }

        // Create inline decoration with severity class (Requirements 1.4, 9.1)
        decorations.push(
            Decoration.inline(issue.from, issue.to, {
                class: `problem problem--${issue.severity}`,
            })
        );

        // Create widget decoration with icon (Requirement 1.5)
        decorations.push(
            Decoration.widget(issue.from, () => renderIcon(issue), {
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

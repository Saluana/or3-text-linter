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
        };
    },

    onDestroy() {
        // Clean up PopoverManager when extension is destroyed to prevent memory leaks
        if (this.storage.popoverManager) {
            this.storage.popoverManager.hide();
            this.storage.popoverManager = null;
        }
    },

    addProseMirrorPlugins() {
        const extension = this;
        let asyncRunId = 0; // Track async runs to avoid stale updates

        // Helper to run async plugins and update decorations
        const runAsyncPluginsAndUpdate = async (
            doc: ProsemirrorNode,
            runId: number
        ) => {
            const asyncIssues = await runAsyncPlugins(
                doc,
                extension.options.plugins
            );

            // Only update if this is still the latest run and editor exists
            if (
                runId === asyncRunId &&
                extension.editor &&
                asyncIssues.length > 0
            ) {
                // Merge with current sync issues
                const currentSyncIssues = runSyncPlugins(
                    extension.editor.state.doc,
                    extension.options.plugins
                );
                const allIssues = [...currentSyncIssues, ...asyncIssues];
                extension.storage.issues = allIssues;

                // Force decoration update by dispatching a metadata transaction
                const tr = extension.editor.state.tr.setMeta(
                    'linterAsyncUpdate',
                    true
                );
                extension.editor.view.dispatch(tr);
            }
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

                        // Kick off async plugins in background
                        asyncRunId++;
                        runAsyncPluginsAndUpdate(state.doc, asyncRunId);

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

                        // Rebuild DecorationSet when document changed (Requirement 1.2)
                        const issues = runSyncPlugins(
                            newState.doc,
                            extension.options.plugins
                        );
                        extension.storage.issues = issues;

                        // Kick off async plugins in background
                        asyncRunId++;
                        runAsyncPluginsAndUpdate(newState.doc, asyncRunId);

                        return createDecorationSet(newState.doc, issues);
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
        try {
            const plugin = new PluginClass(doc);
            const result = plugin.scan();

            // Skip async plugins in sync context
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

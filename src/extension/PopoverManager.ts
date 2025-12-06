import type { EditorView } from '@tiptap/pm/view';
import type {
    Issue,
    PopoverOptions,
    PopoverActions,
    PopoverContext,
    PopoverPlacement,
} from '../types';
import { createApp, type App } from 'vue';

/**
 * Default popover renderer that creates a standard popover UI
 * with severity badge, message, and action buttons.
 *
 * Requirements: 18.3, 18.7
 */
export function createDefaultPopover(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'lint-popover';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-label', 'Lint issue details');

    for (const issue of context.issues) {
        const issueEl = document.createElement('div');
        issueEl.className = `lint-popover__issue lint-popover__issue--${issue.severity}`;

        // Severity badge
        const badge = document.createElement('span');
        badge.className = 'lint-popover__severity';
        badge.textContent = issue.severity;
        issueEl.appendChild(badge);

        // Message
        const message = document.createElement('p');
        message.className = 'lint-popover__message';
        message.textContent = issue.message;
        issueEl.appendChild(message);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'lint-popover__actions';

        if (issue.fix) {
            const fixBtn = document.createElement('button');
            fixBtn.className = 'lint-popover__btn lint-popover__btn--fix';
            fixBtn.textContent = 'Fix';
            fixBtn.setAttribute(
                'aria-label',
                `Apply fix for: ${issue.message}`
            );
            fixBtn.setAttribute('type', 'button');
            fixBtn.onclick = () => context.actions.applyFix();
            actions.appendChild(fixBtn);
        }

        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'lint-popover__btn lint-popover__btn--dismiss';
        dismissBtn.textContent = 'Dismiss';
        dismissBtn.setAttribute(
            'aria-label',
            `Dismiss lint issue: ${issue.message}`
        );
        dismissBtn.setAttribute('type', 'button');
        dismissBtn.onclick = () => context.actions.dismiss();
        actions.appendChild(dismissBtn);

        issueEl.appendChild(actions);
        container.appendChild(issueEl);
    }

    return container;
}

/**
 * PopoverManager handles the display and interaction of lint issue popovers.
 * It manages positioning, close handlers, and action execution.
 *
 * Requirements: 8.1, 8.4, 18.6, 19.1-19.5
 */
export class PopoverManager {
    private popoverEl: HTMLElement | null = null;
    private vueApp: App | null = null;
    private view: EditorView;
    private options: PopoverOptions;
    private boundHandleClickOutside: (event: MouseEvent) => void;
    private boundHandleKeyDown: (event: KeyboardEvent) => void;

    constructor(view: EditorView, options: PopoverOptions = {}) {
        this.view = view;
        this.options = options;
        this.boundHandleClickOutside = this.handleClickOutside.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Display a popover with the given issues positioned near the anchor element.
     *
     * Requirements: 8.1, 18.6, 18.7
     *
     * @param issues - The issue(s) to display in the popover
     * @param anchorEl - The element to position the popover relative to
     */
    show(issues: Issue[], anchorEl: HTMLElement): void {
        // Validate inputs
        if (!issues || !Array.isArray(issues) || issues.length === 0) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn(
                    '[Tiptap Linter] PopoverManager.show() called with invalid issues array'
                );
            }
            return;
        }

        if (!anchorEl || !(anchorEl instanceof HTMLElement)) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn(
                    '[Tiptap Linter] PopoverManager.show() called with invalid anchor element'
                );
            }
            return;
        }

        // Close any existing popover first
        this.hide();

        // Create actions object for the popover context
        const actions: PopoverActions = {
            applyFix: () => this.applyFix(issues),
            deleteText: () => this.deleteText(issues),
            replaceText: (newText: string) => this.replaceText(issues, newText),
            dismiss: () => this.hide(),
        };

        const context: PopoverContext = {
            issues,
            actions,
            view: this.view,
        };

        // Check if Vue component is provided (takes precedence over renderer)
        if (this.options.vueComponent) {
            this.popoverEl = this.renderVueComponent(context);
        } else {
            // Use custom renderer or default
            const renderer = this.options.renderer ?? createDefaultPopover;
            this.popoverEl = renderer(context);
        }

        this.popoverEl.classList.add('lint-popover-container');

        // Apply custom styles if provided
        if (this.options.style) {
            const style = this.options.style;
            if (style.border) this.popoverEl.style.border = style.border;
            if (style.background)
                this.popoverEl.style.background = style.background;
            if (style.padding) this.popoverEl.style.padding = style.padding;
            if (style.borderRadius)
                this.popoverEl.style.borderRadius = style.borderRadius;
            if (style.boxShadow)
                this.popoverEl.style.boxShadow = style.boxShadow;
        }

        // Add to DOM and position
        document.body.appendChild(this.popoverEl);
        this.positionPopover(anchorEl);

        // Setup close handlers (Requirement 8.4)
        this.setupCloseHandlers();
    }

    /**
     * Hide and remove the popover from the DOM.
     */
    hide(): void {
        // Unmount Vue app if it exists
        if (this.vueApp) {
            this.vueApp.unmount();
            this.vueApp = null;
        }

        if (this.popoverEl) {
            this.popoverEl.remove();
            this.popoverEl = null;
        }
        this.removeCloseHandlers();
    }

    /**
     * Check if a popover is currently visible.
     */
    isVisible(): boolean {
        return this.popoverEl !== null;
    }

    /**
     * Render a Vue component as popover content.
     * Creates a Vue app instance and provides the popover actions via injection.
     *
     * @param context - The popover context with issues, actions, and view
     * @returns HTMLElement containing the mounted Vue component
     */
    private renderVueComponent(context: PopoverContext): HTMLElement {
        const container = document.createElement('div');

        if (!this.options.vueComponent) {
            return container;
        }

        const { component, props = {} } = this.options.vueComponent;

        // Create Vue app with the component
        // Note: 'issues' and 'view' props are always set from context and will
        // override any custom props with the same names
        this.vueApp = createApp(component, {
            ...props,
            issues: context.issues,
            view: context.view,
        });

        // Provide popover actions for injection in child components
        this.vueApp.provide('popoverActions', context.actions);
        this.vueApp.provide('popoverContext', context);

        // Mount the app
        this.vueApp.mount(container);

        return container;
    }

    /**
     * Position the popover relative to the anchor element.
     *
     * Requirement: 18.6
     *
     * @param anchorEl - The element to position relative to
     */
    private positionPopover(anchorEl: HTMLElement): void {
        if (!this.popoverEl) return;

        const placement: PopoverPlacement = this.options.placement ?? 'bottom';
        const offset = this.options.style?.offset ?? 8;

        const anchorRect = anchorEl.getBoundingClientRect();
        const popoverRect = this.popoverEl.getBoundingClientRect();

        let top: number;
        let left: number;

        switch (placement) {
            case 'top':
                top = anchorRect.top - popoverRect.height - offset;
                left =
                    anchorRect.left +
                    anchorRect.width / 2 -
                    popoverRect.width / 2;
                break;
            case 'bottom':
                top = anchorRect.bottom + offset;
                left =
                    anchorRect.left +
                    anchorRect.width / 2 -
                    popoverRect.width / 2;
                break;
            case 'left':
                top =
                    anchorRect.top +
                    anchorRect.height / 2 -
                    popoverRect.height / 2;
                left = anchorRect.left - popoverRect.width - offset;
                break;
            case 'right':
                top =
                    anchorRect.top +
                    anchorRect.height / 2 -
                    popoverRect.height / 2;
                left = anchorRect.right + offset;
                break;
        }

        // Ensure popover stays within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < 0) left = offset;
        if (left + popoverRect.width > viewportWidth) {
            left = viewportWidth - popoverRect.width - offset;
        }
        if (top < 0) top = offset;
        if (top + popoverRect.height > viewportHeight) {
            top = viewportHeight - popoverRect.height - offset;
        }

        this.popoverEl.style.position = 'fixed';
        this.popoverEl.style.top = `${top}px`;
        this.popoverEl.style.left = `${left}px`;
        this.popoverEl.style.zIndex = '9999';
    }

    /**
     * Setup event handlers for closing the popover.
     *
     * Requirement: 8.4 - Close on click outside or Escape key
     */
    private setupCloseHandlers(): void {
        // Delay adding click handler to prevent immediate close
        setTimeout(() => {
            document.addEventListener('click', this.boundHandleClickOutside);
        }, 0);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * Remove event handlers for closing the popover.
     */
    private removeCloseHandlers(): void {
        document.removeEventListener('click', this.boundHandleClickOutside);
        document.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * Handle clicks outside the popover to close it.
     */
    private handleClickOutside(event: MouseEvent): void {
        if (this.popoverEl && !this.popoverEl.contains(event.target as Node)) {
            this.hide();
        }
    }

    /**
     * Handle Escape key to close the popover.
     */
    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.hide();
        }
    }

    /**
     * Apply the fix function from the first issue that has one.
     * Closes the popover and focuses the editor after applying.
     *
     * Requirement: 19.1
     *
     * @param issues - The issues to search for a fix function
     */
    private applyFix(issues: Issue[]): void {
        const issue = issues.find((i) => i.fix);
        if (issue?.fix) {
            issue.fix(this.view, issue);
            this.view.focus();
        }
        this.hide();
    }

    /**
     * Delete the text in the first issue's range.
     * Closes the popover and focuses the editor after deletion.
     *
     * Requirement: 19.2
     *
     * @param issues - The issues to get the range from
     */
    private deleteText(issues: Issue[]): void {
        const issue = issues[0];
        if (
            issue &&
            issue.from >= 0 &&
            issue.to <= this.view.state.doc.content.size
        ) {
            const tr = this.view.state.tr
                .delete(issue.from, issue.to)
                .setMeta('linterFix', true); // Mark as linter fix to skip async re-run
            this.view.dispatch(tr);
            this.view.focus();
        }
        this.hide();
    }

    /**
     * Replace the text in the first issue's range with new text.
     * Closes the popover and focuses the editor after replacement.
     *
     * Requirement: 19.3
     *
     * @param issues - The issues to get the range from
     * @param newText - The text to replace with
     */
    private replaceText(issues: Issue[], newText: string): void {
        const issue = issues[0];
        if (
            issue &&
            issue.from >= 0 &&
            issue.to <= this.view.state.doc.content.size
        ) {
            const tr = this.view.state.tr
                .replaceWith(
                    issue.from,
                    issue.to,
                    this.view.state.schema.text(newText)
                )
                .setMeta('linterFix', true); // Mark as linter fix to skip async re-run
            this.view.dispatch(tr);
            this.view.focus();
        }
        this.hide();
    }
}

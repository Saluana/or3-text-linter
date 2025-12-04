/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { PopoverManager } from './PopoverManager';
import { usePopoverActions, usePopoverContext } from './usePopover';
import { defineComponent, h } from 'vue';
import type { Issue } from '../types';

describe('usePopover Composables Tests', () => {
    let editor: Editor;
    let popoverManager: PopoverManager;
    let anchorEl: HTMLElement;

    beforeEach(() => {
        editor = new Editor({
            extensions: [Document, Paragraph, Text],
            content: '<p>Test content for composables.</p>',
        });

        anchorEl = document.createElement('div');
        anchorEl.style.position = 'fixed';
        anchorEl.style.top = '100px';
        anchorEl.style.left = '100px';
        document.body.appendChild(anchorEl);
    });

    afterEach(() => {
        popoverManager?.hide();
        editor.destroy();
        anchorEl.remove();
    });

    it('usePopoverActions provides access to actions within Vue component', async () => {
        let capturedActions: any = null;

        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup() {
                capturedActions = usePopoverActions();
                return () => h('div', 'Test');
            },
        });

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
            },
        });

        const issue: Issue = {
            message: 'Test issue',
            from: 1,
            to: 5,
            severity: 'warning',
        };

        popoverManager.show([issue], anchorEl);

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(capturedActions).not.toBeNull();
        expect(capturedActions.applyFix).toBeInstanceOf(Function);
        expect(capturedActions.deleteText).toBeInstanceOf(Function);
        expect(capturedActions.replaceText).toBeInstanceOf(Function);
        expect(capturedActions.dismiss).toBeInstanceOf(Function);
    });

    it('usePopoverContext provides access to full context within Vue component', async () => {
        let capturedContext: any = null;

        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup() {
                capturedContext = usePopoverContext();
                return () => h('div', 'Test');
            },
        });

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
            },
        });

        const issue: Issue = {
            message: 'Test issue',
            from: 1,
            to: 5,
            severity: 'error',
        };

        popoverManager.show([issue], anchorEl);

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(capturedContext).not.toBeNull();
        expect(capturedContext.issues).toHaveLength(1);
        expect(capturedContext.issues[0].message).toBe('Test issue');
        expect(capturedContext.actions).toBeDefined();
        expect(capturedContext.view).toBeDefined();
    });

    it('actions.dismiss closes the popover', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup() {
                const actions = usePopoverActions();
                // Auto-dismiss after mounting
                setTimeout(() => actions.dismiss(), 10);
                return () => h('div', 'Test');
            },
        });

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
            },
        });

        const issue: Issue = {
            message: 'Test issue',
            from: 1,
            to: 5,
            severity: 'info',
        };

        popoverManager.show([issue], anchorEl);
        expect(popoverManager.isVisible()).toBe(true);

        // Wait for component to mount and dismiss
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(popoverManager.isVisible()).toBe(false);
    });

    it('throws error when usePopoverActions is used outside popover context', () => {
        expect(() => {
            usePopoverActions();
        }).toThrow('usePopoverActions must be called within a Vue component rendered in a popover');
    });

    it('throws error when usePopoverContext is used outside popover context', () => {
        expect(() => {
            usePopoverContext();
        }).toThrow('usePopoverContext must be called within a Vue component rendered in a popover');
    });
});

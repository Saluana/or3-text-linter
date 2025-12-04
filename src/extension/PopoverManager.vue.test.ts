/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { PopoverManager } from './PopoverManager';
import { defineComponent, h } from 'vue';
import type { Issue } from '../types';

describe('PopoverManager Vue Component Tests', () => {
    let editor: Editor;
    let popoverManager: PopoverManager;
    let anchorEl: HTMLElement;

    beforeEach(() => {
        // Create editor with enough content for testing
        editor = new Editor({
            extensions: [Document, Paragraph, Text],
            content:
                '<p>This is test content for the popover manager testing purposes.</p>',
        });

        anchorEl = document.createElement('div');
        anchorEl.style.position = 'fixed';
        anchorEl.style.top = '100px';
        anchorEl.style.left = '100px';
        anchorEl.style.width = '20px';
        anchorEl.style.height = '20px';
        document.body.appendChild(anchorEl);
    });

    afterEach(() => {
        popoverManager?.hide();
        editor.destroy();
        anchorEl.remove();
    });

    it('renders a Vue component when vueComponent option is provided', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup(props) {
                return () =>
                    h(
                        'div',
                        { class: 'test-vue-popover' },
                        `Issues: ${props.issues?.length}`
                    );
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

        expect(popoverManager.isVisible()).toBe(true);
        const popoverContent = document.querySelector('.test-vue-popover');
        expect(popoverContent).not.toBeNull();
        expect(popoverContent?.textContent).toBe('Issues: 1');
    });

    it('passes issues as props to Vue component', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup(props) {
                return () => {
                    const messages = (props.issues as Issue[] | undefined)?.map((i) => i.message);
                    return h('div', { class: 'test-messages' }, messages?.join(', '));
                };
            },
        });

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
            },
        });

        const issues: Issue[] = [
            {
                message: 'First issue',
                from: 1,
                to: 5,
                severity: 'warning',
            },
            {
                message: 'Second issue',
                from: 1,
                to: 5,
                severity: 'error',
            },
        ];

        popoverManager.show(issues, anchorEl);

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        const messagesEl = document.querySelector('.test-messages');
        expect(messagesEl?.textContent).toBe('First issue, Second issue');
    });

    it('passes additional props to Vue component', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
                customProp: String,
            },
            setup(props) {
                return () =>
                    h(
                        'div',
                        { class: 'test-custom-prop' },
                        props.customProp || ''
                    );
            },
        });

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
                props: {
                    customProp: 'Custom value',
                },
            },
        });

        const issue: Issue = {
            message: 'Test issue',
            from: 1,
            to: 5,
            severity: 'info',
        };

        popoverManager.show([issue], anchorEl);

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        const customEl = document.querySelector('.test-custom-prop');
        expect(customEl?.textContent).toBe('Custom value');
    });

    it('unmounts Vue component when popover is hidden', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup() {
                return () => h('div', { class: 'test-unmount' }, 'Mounted');
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

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(document.querySelector('.test-unmount')).not.toBeNull();

        popoverManager.hide();

        // Component should be unmounted
        expect(document.querySelector('.test-unmount')).toBeNull();
        expect(popoverManager.isVisible()).toBe(false);
    });

    it('prefers vueComponent over renderer when both are provided', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup() {
                return () => h('div', { class: 'vue-component' }, 'Vue');
            },
        });

        const customRenderer = () => {
            const el = document.createElement('div');
            el.className = 'custom-renderer';
            el.textContent = 'Renderer';
            return el;
        };

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
            },
            renderer: customRenderer,
        });

        const issue: Issue = {
            message: 'Test issue',
            from: 1,
            to: 5,
            severity: 'info',
        };

        popoverManager.show([issue], anchorEl);

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(document.querySelector('.vue-component')).not.toBeNull();
        expect(document.querySelector('.custom-renderer')).toBeNull();
    });

    it('applies custom styles to Vue component popover', async () => {
        const TestComponent = defineComponent({
            props: {
                issues: Array,
            },
            setup() {
                return () => h('div', 'Content');
            },
        });

        popoverManager = new PopoverManager(editor.view, {
            vueComponent: {
                component: TestComponent,
            },
            style: {
                background: 'rgb(255, 0, 0)',
                border: '2px solid blue',
                padding: '20px',
            },
        });

        const issue: Issue = {
            message: 'Test issue',
            from: 1,
            to: 5,
            severity: 'info',
        };

        popoverManager.show([issue], anchorEl);

        // Wait for Vue to mount
        await new Promise((resolve) => setTimeout(resolve, 50));

        const container = document.querySelector('.lint-popover-container') as HTMLElement;
        expect(container).not.toBeNull();
        expect(container.style.background).toBe('rgb(255, 0, 0)');
        expect(container.style.border).toBe('2px solid blue');
        expect(container.style.padding).toBe('20px');
    });
});

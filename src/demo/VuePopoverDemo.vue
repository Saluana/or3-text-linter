<script setup lang="ts">
import { shallowRef, onMounted, onBeforeUnmount } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Text from '@tiptap/extension-text';
import { Linter } from '../extension/Linter';
import { BadWords } from '../extension/plugins/BadWords';
import { Punctuation } from '../extension/plugins/Punctuation';
import { HeadingLevel } from '../extension/plugins/HeadingLevel';
import IssuePopover from './components/IssuePopover.vue';

// Editor instance ref - using shallowRef as recommended for Tiptap
const editor = shallowRef<Editor | null>(null);

// Sample content with known issues for demonstration
const sampleContent = `
<h1>Introduction</h1>
<p>This is obviously a demonstration of the linter extension. It clearly shows how the linter works .</p>
<h3>Skipped Heading Level</h3>
<p>This heading simply jumped from H1 to H3 , which is a problem!</p>
<h4>Another Skip</h4>
<p>We evidently have multiple issues here !</p>
`;

onMounted(() => {
    // Create Tiptap editor with Linter extension configured
    // Using Vue component for popover rendering
    editor.value = new Editor({
        extensions: [
            Document,
            Paragraph,
            Heading.configure({
                levels: [1, 2, 3, 4, 5, 6],
            }),
            Text,
            Linter.configure({
                plugins: [BadWords, Punctuation, HeadingLevel],
                // Use Vue component for popover rendering
                popover: {
                    vueComponent: {
                        component: IssuePopover,
                        // Optional: pass additional props
                        props: {
                            // any custom props you want to pass
                        },
                    },
                    placement: 'bottom',
                },
            }),
        ],
        content: sampleContent,
    });
});

onBeforeUnmount(() => {
    // Destroy editor instance on unmount
    editor.value?.destroy();
});
</script>

<template>
    <div class="linter-demo">
        <h2>Vue Component Popover Demo</h2>
        <p class="description">
            This demo uses a Vue component for the popover. Click on lint icons
            to see the Vue-powered popover with reactive interactions. The
            component uses the <code>usePopoverActions()</code> composable to
            access popover actions.
        </p>
        <div class="editor-wrapper">
            <editor-content
                v-if="editor"
                :editor="editor"
                class="editor-content"
            />
        </div>
        <div class="features">
            <h3>Features</h3>
            <ul>
                <li>✅ Vue 3 component with Composition API</li>
                <li>✅ Type-safe with TypeScript</li>
                <li>✅ Clean access to popover actions via composable</li>
                <li>✅ Scoped styles with Vue SFC</li>
                <li>✅ Reactive and performant</li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.linter-demo {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
        Ubuntu, sans-serif;
}

.description {
    color: #666;
    margin-bottom: 16px;
}

.description code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
    color: #d97706;
}

.editor-wrapper {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    min-height: 200px;
    background: #fff;
}

.editor-content {
    outline: none;
}

.editor-content :deep(.ProseMirror) {
    outline: none;
    min-height: 150px;
}

.editor-content :deep(.ProseMirror p) {
    margin: 0.5em 0;
}

.editor-content :deep(.ProseMirror h1),
.editor-content :deep(.ProseMirror h2),
.editor-content :deep(.ProseMirror h3),
.editor-content :deep(.ProseMirror h4),
.editor-content :deep(.ProseMirror h5),
.editor-content :deep(.ProseMirror h6) {
    margin: 0.75em 0 0.5em;
}

/* Problem highlight styles */
.editor-content :deep(.problem) {
    background-color: rgba(255, 200, 0, 0.3);
    border-bottom: 2px solid transparent;
    position: relative;
}

.editor-content :deep(.problem--info) {
    background-color: rgba(59, 130, 246, 0.2);
    border-bottom-color: #3b82f6;
}

.editor-content :deep(.problem--warning) {
    background-color: rgba(245, 158, 11, 0.2);
    border-bottom-color: #f59e0b;
}

.editor-content :deep(.problem--error) {
    background-color: rgba(239, 68, 68, 0.2);
    border-bottom-color: #ef4444;
}

/* Lint icon styles */
.editor-content :deep(.lint-icon) {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    vertical-align: middle;
    margin-right: 2px;
    position: relative;
    top: -1px;
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    color: white;
    font-weight: bold;
    transition: transform 0.15s ease;
}

.editor-content :deep(.lint-icon:hover) {
    transform: scale(1.2);
}

.editor-content :deep(.lint-icon::before) {
    content: '!';
}

.editor-content :deep(.lint-icon--info) {
    background-color: #3b82f6;
}

.editor-content :deep(.lint-icon--info::before) {
    content: 'i';
}

.editor-content :deep(.lint-icon--warning) {
    background-color: #f59e0b;
}

.editor-content :deep(.lint-icon--error) {
    background-color: #ef4444;
}

/* Popover container styles */
.editor-content :deep(.lint-popover-container) {
    position: fixed;
    z-index: 9999;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    max-width: 320px;
}

/* Arrow/pointer indicator */
.editor-content :deep(.lint-popover-container)::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid #e5e7eb;
}

.editor-content :deep(.lint-popover-container)::after {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 5px solid #ffffff;
}

/* Features section */
.features {
    margin-top: 24px;
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
}

.features h3 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #374151;
}

.features ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.features li {
    padding: 4px 0;
    font-size: 14px;
    color: #4b5563;
}
</style>

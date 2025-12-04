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

// Editor instance ref - using shallowRef as recommended for Tiptap
const editor = shallowRef<Editor | null>(null);

// Sample content with known issues for demonstration
// - BadWords: "obviously", "clearly", "simply"
// - Punctuation: spaces before punctuation marks
// - HeadingLevel: H1 jumping to H3 (skipping H2)
const sampleContent = `
<h1>Introduction</h1>
<p>This is obviously a demonstration of the linter extension. It clearly shows how the linter works .</p>
<h3>Skipped Heading Level</h3>
<p>This heading simply jumped from H1 to H3 , which is a problem!</p>
<h4>Another Skip</h4>
<p>We evidently have multiple issues here !</p>
`;

onMounted(() => {
    // Create Tiptap editor with Linter extension configured (Requirement 11.1)
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
            }),
        ],
        content: sampleContent,
    });
});

onBeforeUnmount(() => {
    // Destroy editor instance on unmount (Requirement 11.2)
    editor.value?.destroy();
});
</script>

<template>
    <div class="linter-demo">
        <h2>Tiptap Linter Demo</h2>
        <p class="description">
            Click on lint icons to select the issue. Double-click to auto-fix
            (where available).
        </p>
        <div class="editor-wrapper">
            <editor-content
                v-if="editor"
                :editor="editor"
                class="editor-content"
            />
        </div>
        <div class="legend">
            <h3>Legend</h3>
            <ul>
                <li>
                    <span class="legend-icon legend-icon--info"></span> Info
                </li>
                <li>
                    <span class="legend-icon legend-icon--warning"></span>
                    Warning
                </li>
                <li>
                    <span class="legend-icon legend-icon--error"></span> Error
                </li>
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

/* Problem highlight styles with severity variants (Requirement 9.3, 11.3) */
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

/* Lint icon styles with severity variants (Requirement 9.3, 11.3) */
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

/* Legend styles */
.legend {
    margin-top: 24px;
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
}

.legend h3 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #374151;
}

.legend ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: 24px;
}

.legend li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #4b5563;
}

.legend-icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
}

.legend-icon--info {
    background-color: #3b82f6;
}

.legend-icon--warning {
    background-color: #f59e0b;
}

.legend-icon--error {
    background-color: #ef4444;
}
</style>

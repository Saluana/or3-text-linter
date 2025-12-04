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
import type { PopoverContext } from '../types';

// Editor instance ref - using shallowRef as recommended for Tiptap
const editor = shallowRef<Editor | null>(null);

// Sample content with known issues for demonstration
// - BadWords: "obviously", "clearly", "evidently", "simply" (warning severity)
// - Punctuation: spaces before punctuation marks (warning severity, with auto-fix)
// - HeadingLevel: H1 jumping to H3 (skipping H2) (error severity, with auto-fix)
const sampleContent = `
<h1>Introduction</h1>
<p>This is obviously a demonstration of the linter extension. It clearly shows how the linter works .</p>
<h3>Skipped Heading Level</h3>
<p>This heading simply jumped from H1 to H3 , which is a problem!</p>
<h4>Another Skip</h4>
<p>We evidently have multiple issues here !</p>
`;

/**
 * Custom popover renderer demonstrating how to create a custom UI.
 * This example adds emoji indicators and custom styling.
 * (Requirement 18.1 - custom popover renderer)
 */
function customPopoverRenderer(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'lint-popover lint-popover--custom';

    for (const issue of context.issues) {
        const issueEl = document.createElement('div');
        issueEl.className = `lint-popover__issue lint-popover__issue--${issue.severity}`;

        // Emoji indicator based on severity
        const emoji =
            issue.severity === 'error'
                ? '🚨'
                : issue.severity === 'warning'
                ? '⚠️'
                : 'ℹ️';

        // Header with emoji and severity
        const header = document.createElement('div');
        header.className = 'lint-popover__header';
        header.innerHTML = `<span class="lint-popover__emoji">${emoji}</span><span class="lint-popover__severity">${issue.severity}</span>`;
        issueEl.appendChild(header);

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
            fixBtn.textContent = '✨ Fix it';
            fixBtn.onclick = () => context.actions.applyFix();
            actions.appendChild(fixBtn);
        }

        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'lint-popover__btn lint-popover__btn--dismiss';
        dismissBtn.textContent = '✕ Dismiss';
        dismissBtn.onclick = () => context.actions.dismiss();
        actions.appendChild(dismissBtn);

        issueEl.appendChild(actions);
        container.appendChild(issueEl);
    }

    return container;
}

onMounted(() => {
    // Create Tiptap editor with Linter extension configured (Requirement 11.1)
    // Popover is enabled with custom renderer (Requirements 11.3, 18.1)
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
                // Enable popover with custom renderer (Requirement 18.1)
                popover: {
                    renderer: customPopoverRenderer,
                    placement: 'bottom',
                },
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
            Click on lint icons to open a popover with issue details and
            available actions. Issues with auto-fix show a "Fix it" button.
            Press Escape or click outside to dismiss.
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
            <p class="legend-note">
                This demo uses a custom popover renderer with emoji indicators.
            </p>
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

.legend-note {
    margin-top: 12px;
    font-size: 12px;
    color: #6b7280;
    font-style: italic;
}

/* Popover container styles (Requirement 9.3, 16.2) */
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

.editor-content :deep(.lint-popover) {
    padding: 0;
}

.editor-content :deep(.lint-popover__issue) {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
}

.editor-content :deep(.lint-popover__issue:last-child) {
    border-bottom: none;
}

/* Severity badge styles */
.editor-content :deep(.lint-popover__severity) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

/* Severity variants for popover issues */
.editor-content :deep(.lint-popover__issue--info) .lint-popover__severity {
    background-color: rgba(59, 130, 246, 0.15);
    color: #2563eb;
}

.editor-content :deep(.lint-popover__issue--warning) .lint-popover__severity {
    background-color: rgba(245, 158, 11, 0.15);
    color: #d97706;
}

.editor-content :deep(.lint-popover__issue--error) .lint-popover__severity {
    background-color: rgba(239, 68, 68, 0.15);
    color: #dc2626;
}

/* Issue message styles */
.editor-content :deep(.lint-popover__message) {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.5;
    color: #374151;
}

/* Action buttons container */
.editor-content :deep(.lint-popover__actions) {
    display: flex;
    gap: 8px;
}

/* Base button styles */
.editor-content :deep(.lint-popover__btn) {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
}

/* Fix button styles */
.editor-content :deep(.lint-popover__btn--fix) {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

.editor-content :deep(.lint-popover__btn--fix:hover) {
    background-color: #2563eb;
    border-color: #2563eb;
}

/* Dismiss button styles */
.editor-content :deep(.lint-popover__btn--dismiss) {
    background-color: #f3f4f6;
    color: #4b5563;
    border-color: #d1d5db;
}

.editor-content :deep(.lint-popover__btn--dismiss:hover) {
    background-color: #e5e7eb;
    border-color: #9ca3af;
}

/* Custom popover renderer styles (Requirement 18.1) */
.editor-content :deep(.lint-popover--custom) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        sans-serif;
}

.editor-content :deep(.lint-popover__header) {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
}

.editor-content :deep(.lint-popover__emoji) {
    font-size: 16px;
}
</style>

<script setup lang="ts">
import { usePopoverActions } from '../../extension/usePopover';
import type { Issue } from '../../types';

// Props passed from PopoverManager
defineProps<{
    issues: Issue[];
}>();

// Access popover actions via composable
const actions = usePopoverActions();

// Helper to get emoji for severity
function getSeverityEmoji(severity: string): string {
    switch (severity) {
        case 'error':
            return '🚨';
        case 'warning':
            return '⚠️';
        case 'info':
            return 'ℹ️';
        default:
            return '•';
    }
}
</script>

<template>
    <div class="vue-popover">
        <div
            v-for="(issue, index) in issues"
            :key="index"
            :class="['vue-popover__issue', `vue-popover__issue--${issue.severity}`]"
        >
            <div class="vue-popover__header">
                <span class="vue-popover__emoji">{{
                    getSeverityEmoji(issue.severity)
                }}</span>
                <span class="vue-popover__severity">{{ issue.severity }}</span>
            </div>

            <p class="vue-popover__message">{{ issue.message }}</p>

            <div class="vue-popover__actions">
                <button
                    v-if="issue.fix"
                    class="vue-popover__btn vue-popover__btn--fix"
                    @click="actions.applyFix()"
                >
                    ✨ Fix it
                </button>
                <button
                    class="vue-popover__btn vue-popover__btn--dismiss"
                    @click="actions.dismiss()"
                >
                    ✕ Dismiss
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.vue-popover {
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        sans-serif;
}

.vue-popover__issue {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
}

.vue-popover__issue:last-child {
    border-bottom: none;
}

.vue-popover__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
}

.vue-popover__emoji {
    font-size: 16px;
}

.vue-popover__severity {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.vue-popover__issue--info .vue-popover__severity {
    background-color: rgba(59, 130, 246, 0.15);
    color: #2563eb;
}

.vue-popover__issue--warning .vue-popover__severity {
    background-color: rgba(245, 158, 11, 0.15);
    color: #d97706;
}

.vue-popover__issue--error .vue-popover__severity {
    background-color: rgba(239, 68, 68, 0.15);
    color: #dc2626;
}

.vue-popover__message {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.5;
    color: #374151;
}

.vue-popover__actions {
    display: flex;
    gap: 8px;
}

.vue-popover__btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
}

.vue-popover__btn--fix {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

.vue-popover__btn--fix:hover {
    background-color: #2563eb;
    border-color: #2563eb;
}

.vue-popover__btn--dismiss {
    background-color: #f3f4f6;
    color: #4b5563;
    border-color: #d1d5db;
}

.vue-popover__btn--dismiss:hover {
    background-color: #e5e7eb;
    border-color: #9ca3af;
}
</style>

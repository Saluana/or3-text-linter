<script setup lang="ts">
import { shallowRef, ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Text from '@tiptap/extension-text';
import { Linter, type LinterStorage } from '../extension/Linter';
import { BadWords } from '../extension/plugins/BadWords';
import { Punctuation } from '../extension/plugins/Punctuation';
import { HeadingLevel } from '../extension/plugins/HeadingLevel';
import { createNaturalLanguageRule } from '../factory/createNaturalLanguageRule';
import IssuePopover from './components/IssuePopover.vue';
import { OpenRouter } from '@openrouter/sdk';
import type {
    Issue,
    CustomSeverity,
    PluginConfig,
    AITool,
    AsyncLinterPluginClass,
} from '../types';

const STORAGE_KEY = 'openrouter_api_key';

// Editor instance ref
const editor = shallowRef<Editor | null>(null);
const openRouter = shallowRef<OpenRouter | null>(null);

// State for on-demand results
const onDemandIssues = ref<Issue[]>([]);
const isRunning = ref(false);
const selectedPlugin = ref<'BadWords' | 'Punctuation' | 'HeadingLevel'>(
    'BadWords'
);
const applyResults = ref(false);

// State for natural language rules
const customRuleText = ref(
    'Avoid using passive voice. Prefer active voice constructions.'
);
const customRules = ref<
    { name: string; rule: string; pluginClass: AsyncLinterPluginClass }[]
>([]);
const selectedCustomRule = ref<string | null>(null);
const isRunningCustom = ref(false);
const customRuleIssues = ref<Issue[]>([]);
const applyCustomResults = ref(false);

// State for ignored issues count
const ignoredCount = computed(() => {
    if (!editor.value) return 0;
    const storage = editor.value.storage.linter as LinterStorage;
    return storage?.ignoredIssues?.length ?? 0;
});

// Custom severity definitions
const customSeverities: CustomSeverity[] = [
    { name: 'suggestion', color: '#8b5cf6' }, // Purple
    { name: 'style', color: '#06b6d4' }, // Cyan
    { name: 'ai', color: '#10b981' }, // Green for AI rules
];

// Sample content with known issues
const sampleContent = `
<h1>On-Demand Linting Demo</h1>

<p>This demo obviously shows the new on-demand linting features . You can clearly see how plugins work .</p>

<h3>Skipped Heading Level</h3>

<p>This heading simply jumped from H1 to H3 , which is evidently a problem!</p>

<p>The document was written by the team. Mistakes were made by someone. The code was reviewed by developers.</p>

<p>Try clicking the buttons below to run specific rules on demand .</p>
`;

// AI Provider function using OpenRouter
const aiProvider = async (
    systemPrompt: string,
    content: string,
    tools?: AITool[]
) => {
    if (!openRouter.value) {
        throw new Error('OpenRouter not initialized. Please set your API key.');
    }

    const data = await openRouter.value.chat.send({
        model: 'moonshotai/kimi-k2-0905:exacto',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
        ],
        tools,
        toolChoice: {
            type: 'function',
            function: { name: 'report_lint_issues' },
        },
        stream: false,
    });

    if (!data?.choices?.[0]?.message) {
        throw new Error('No response from AI');
    }

    const message = data.choices[0].message;
    const toolCalls = message.toolCalls ?? [];

    if (toolCalls.length > 0) {
        const allIssues: Array<{
            message: string;
            textMatch: string;
            suggestion?: string;
        }> = [];
        for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'report_lint_issues') {
                try {
                    const result = JSON.parse(
                        toolCall.function.arguments as string
                    );
                    if (result.issues) allIssues.push(...result.issues);
                } catch {
                    /* skip malformed */
                }
            }
        }
        return { issues: allIssues };
    }
    return { issues: [] };
};

// Plugin map for on-demand execution
const pluginMap = {
    BadWords,
    Punctuation,
    HeadingLevel,
};

// Run a specific rule on demand
async function runSelectedRule() {
    if (!editor.value || isRunning.value) return;

    isRunning.value = true;
    onDemandIssues.value = [];

    try {
        const storage = editor.value.storage.linter as LinterStorage;
        const PluginClass = pluginMap[selectedPlugin.value];

        const issues = await storage.runRule(PluginClass, {
            applyResults: applyResults.value,
        });

        onDemandIssues.value = issues;
    } catch (error) {
        console.error('Error running rule:', error);
    } finally {
        isRunning.value = false;
    }
}

// Register a new natural language rule
function registerCustomRule() {
    if (!customRuleText.value.trim() || !openRouter.value) {
        alert('Please enter a rule and ensure API key is set.');
        return;
    }

    const ruleName = `Rule ${customRules.value.length + 1}`;
    const pluginClass = createNaturalLanguageRule({
        rule: customRuleText.value.trim(),
        provider: aiProvider,
        severity: 'ai' as any, // Use our custom 'ai' severity
    });

    customRules.value.push({
        name: ruleName,
        rule: customRuleText.value.trim(),
        pluginClass,
    });

    // Auto-select the new rule
    selectedCustomRule.value = ruleName;
    customRuleText.value = '';
}

// Run selected custom rule
async function runCustomRule() {
    if (!editor.value || !selectedCustomRule.value || isRunningCustom.value)
        return;

    const rule = customRules.value.find(
        (r) => r.name === selectedCustomRule.value
    );
    if (!rule) return;

    isRunningCustom.value = true;
    customRuleIssues.value = [];

    try {
        const storage = editor.value.storage.linter as LinterStorage;
        const issues = await storage.runRule(rule.pluginClass, {
            applyResults: applyCustomResults.value,
        });
        customRuleIssues.value = issues;
    } catch (error) {
        console.error('Error running custom rule:', error);
        alert('Error running rule: ' + (error as Error).message);
    } finally {
        isRunningCustom.value = false;
    }
}

// Remove a custom rule
function removeCustomRule(name: string) {
    customRules.value = customRules.value.filter((r) => r.name !== name);
    if (selectedCustomRule.value === name) {
        selectedCustomRule.value = customRules.value[0]?.name ?? null;
    }
}

// Set API key
function setApiKey() {
    const key = prompt('Enter your OpenRouter API key:');
    if (key) {
        localStorage.setItem(STORAGE_KEY, key);
        openRouter.value = new OpenRouter({ apiKey: key });
    }
}

// Clear ignored issues
function clearIgnored() {
    if (!editor.value) return;
    const storage = editor.value.storage.linter as LinterStorage;
    storage.clearIgnoredIssues();
    // Trigger re-lint by dispatching a transaction
    const tr = editor.value.state.tr.setMeta('linterAsyncUpdate', true);
    editor.value.view.dispatch(tr);
}

// Plugin configurations - HeadingLevel is on-demand only
const pluginConfigs: PluginConfig[] = [
    { plugin: BadWords, mode: 'auto' },
    { plugin: Punctuation, mode: 'auto' },
    { plugin: HeadingLevel, mode: 'onDemand' }, // Only runs when explicitly triggered
];

onMounted(() => {
    // Initialize OpenRouter if API key exists
    const apiKey = localStorage.getItem(STORAGE_KEY);
    if (apiKey) {
        openRouter.value = new OpenRouter({ apiKey });
    }

    editor.value = new Editor({
        extensions: [
            Document,
            Paragraph,
            Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
            Text,
            Linter.configure({
                plugins: pluginConfigs,
                customSeverities,
                popover: {
                    vueComponent: { component: IssuePopover },
                    placement: 'bottom',
                },
            }),
        ],
        content: sampleContent,
    });
});

onBeforeUnmount(() => {
    editor.value?.destroy();
    openRouter.value = null;
});
</script>

<template>
    <div class="on-demand-demo">
        <h2>On-Demand Linting Demo</h2>
        <p class="description">
            This demo showcases the new on-demand linting features including
            <code>runRule()</code>, plugin modes, custom severities, and ignore
            functionality.
        </p>

        <div class="editor-wrapper">
            <editor-content
                v-if="editor"
                :editor="editor"
                class="editor-content"
            />
        </div>

        <!-- On-Demand Controls -->
        <div class="controls-panel">
            <h3>On-Demand Linting</h3>
            <p class="hint">
                HeadingLevel plugin is configured as <code>onDemand</code> mode
                - it won't run automatically, only when you click "Run Rule".
            </p>

            <div class="control-row">
                <label>
                    Select Plugin:
                    <select v-model="selectedPlugin">
                        <option value="BadWords">BadWords (auto mode)</option>
                        <option value="Punctuation">
                            Punctuation (auto mode)
                        </option>
                        <option value="HeadingLevel">
                            HeadingLevel (onDemand mode)
                        </option>
                    </select>
                </label>

                <label class="checkbox-label">
                    <input type="checkbox" v-model="applyResults" />
                    Apply results to editor
                </label>

                <button
                    @click="runSelectedRule"
                    :disabled="isRunning"
                    class="run-btn"
                >
                    {{ isRunning ? 'Running...' : 'Run Rule' }}
                </button>
            </div>

            <!-- Results Display -->
            <div v-if="onDemandIssues.length > 0" class="results">
                <h4>Results ({{ onDemandIssues.length }} issues)</h4>
                <ul>
                    <li
                        v-for="(issue, idx) in onDemandIssues"
                        :key="idx"
                        :class="`issue--${issue.severity}`"
                    >
                        <span class="severity-badge">{{ issue.severity }}</span>
                        {{ issue.message }}
                        <span class="position"
                            >({{ issue.from }}-{{ issue.to }})</span
                        >
                    </li>
                </ul>
            </div>
            <div
                v-else-if="!isRunning && onDemandIssues.length === 0"
                class="no-results"
            >
                Click "Run Rule" to see results
            </div>
        </div>

        <!-- Natural Language Rules -->
        <div class="ai-rules-panel">
            <h3>🤖 Natural Language Rules (AI-Powered)</h3>
            <p class="hint">
                Create custom lint rules using plain English. Requires an
                OpenRouter API key.
                <button
                    v-if="!openRouter"
                    @click="setApiKey"
                    class="api-key-btn"
                >
                    Set API Key
                </button>
                <span v-else class="api-status">✓ API Key Set</span>
            </p>

            <!-- Create new rule -->
            <div class="rule-input-row">
                <textarea
                    v-model="customRuleText"
                    placeholder="Enter a rule in plain English, e.g., 'Avoid using passive voice'"
                    class="rule-textarea"
                    rows="2"
                ></textarea>
                <button
                    @click="registerCustomRule"
                    :disabled="!customRuleText.trim() || !openRouter"
                    class="add-rule-btn"
                >
                    + Add Rule
                </button>
            </div>

            <!-- Registered rules -->
            <div v-if="customRules.length > 0" class="registered-rules">
                <h4>Registered Rules</h4>
                <div
                    v-for="rule in customRules"
                    :key="rule.name"
                    class="rule-item"
                >
                    <input
                        type="radio"
                        :id="rule.name"
                        :value="rule.name"
                        v-model="selectedCustomRule"
                    />
                    <label :for="rule.name" class="rule-label">
                        <strong>{{ rule.name }}:</strong> {{ rule.rule }}
                    </label>
                    <button
                        @click="removeCustomRule(rule.name)"
                        class="remove-rule-btn"
                    >
                        ×
                    </button>
                </div>

                <div class="control-row" style="margin-top: 12px">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="applyCustomResults" />
                        Apply results to editor
                    </label>
                    <button
                        @click="runCustomRule"
                        :disabled="!selectedCustomRule || isRunningCustom"
                        class="run-btn ai-run-btn"
                    >
                        {{
                            isRunningCustom
                                ? '🔄 Running AI...'
                                : '🚀 Run AI Rule'
                        }}
                    </button>
                </div>

                <!-- AI Results -->
                <div
                    v-if="customRuleIssues.length > 0"
                    class="results ai-results"
                >
                    <h4>AI Results ({{ customRuleIssues.length }} issues)</h4>
                    <ul>
                        <li
                            v-for="(issue, idx) in customRuleIssues"
                            :key="idx"
                            class="issue--ai"
                        >
                            <span class="severity-badge ai-badge">AI</span>
                            {{ issue.message }}
                            <span class="position"
                                >({{ issue.from }}-{{ issue.to }})</span
                            >
                        </li>
                    </ul>
                </div>
            </div>
            <div v-else class="no-rules">
                No custom rules registered yet. Add one above!
            </div>
        </div>

        <!-- Ignore Controls -->
        <div class="ignore-panel">
            <h3>Ignored Issues</h3>
            <p class="hint">
                Click on a lint icon and use the "Ignore" button to dismiss
                issues. Ignored issues won't reappear at the same position.
            </p>
            <div class="control-row">
                <span
                    >Currently ignored:
                    <strong>{{ ignoredCount }}</strong></span
                >
                <button
                    @click="clearIgnored"
                    :disabled="ignoredCount === 0"
                    class="clear-btn"
                >
                    Clear All Ignored
                </button>
            </div>
        </div>

        <!-- Features List -->
        <div class="features">
            <h3>New Features Demonstrated</h3>
            <ul>
                <li>
                    ✅ <strong>runRule()</strong> - Execute specific plugins
                    on-demand
                </li>
                <li>
                    ✅ <strong>Plugin Modes</strong> - Configure plugins as
                    'auto' or 'onDemand'
                </li>
                <li>
                    ✅ <strong>Custom Severities</strong> - Added 'suggestion'
                    (purple), 'style' (cyan), and 'ai' (green)
                </li>
                <li>
                    ✅ <strong>Ignore Issues</strong> - Dismiss false positives
                    via popover
                </li>
                <li>
                    ✅ <strong>Natural Language Rules</strong> - Create
                    AI-powered rules in plain English
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.on-demand-demo {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        sans-serif;
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
    margin-bottom: 20px;
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
.editor-content :deep(.ProseMirror h3) {
    margin: 0.75em 0 0.5em;
}

/* Problem highlight styles */
.editor-content :deep(.problem) {
    background-color: rgba(255, 200, 0, 0.3);
    border-bottom: 2px solid transparent;
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

/* Popover container */
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

/* Control panels */
.controls-panel,
.ignore-panel {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}

.controls-panel h3,
.ignore-panel h3,
.features h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: #374151;
}

.hint {
    font-size: 13px;
    color: #6b7280;
    margin: 0 0 12px;
}

.hint code {
    background: #e5e7eb;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.9em;
}

.control-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.control-row label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #4b5563;
}

.control-row select {
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
}

.checkbox-label {
    cursor: pointer;
}

.checkbox-label input {
    cursor: pointer;
}

.run-btn {
    padding: 8px 16px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.run-btn:hover:not(:disabled) {
    background: #5a67d8;
}

.run-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}

.clear-btn {
    padding: 6px 12px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
}

.clear-btn:hover:not(:disabled) {
    background: #dc2626;
}

.clear-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}

/* Results display */
.results {
    margin-top: 16px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
}

.results h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #374151;
}

.results ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.results li {
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.results li.issue--warning {
    background: rgba(245, 158, 11, 0.1);
}

.results li.issue--error {
    background: rgba(239, 68, 68, 0.1);
}

.results li.issue--info {
    background: rgba(59, 130, 246, 0.1);
}

.severity-badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
}

.issue--warning .severity-badge {
    background: #f59e0b;
    color: white;
}

.issue--error .severity-badge {
    background: #ef4444;
    color: white;
}

.issue--info .severity-badge {
    background: #3b82f6;
    color: white;
}

.position {
    color: #9ca3af;
    font-size: 11px;
    margin-left: auto;
}

.no-results {
    margin-top: 12px;
    color: #9ca3af;
    font-size: 13px;
    font-style: italic;
}

/* AI Rules Panel */
.ai-rules-panel {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border: 1px solid #86efac;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}

.ai-rules-panel h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: #166534;
}

.api-key-btn {
    padding: 4px 10px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    margin-left: 8px;
}

.api-key-btn:hover {
    background: #059669;
}

.api-status {
    color: #059669;
    font-weight: 500;
    margin-left: 8px;
}

.rule-input-row {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}

.rule-textarea {
    flex: 1;
    padding: 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
}

.rule-textarea:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.add-rule-btn {
    padding: 10px 16px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
}

.add-rule-btn:hover:not(:disabled) {
    background: #059669;
}

.add-rule-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}

.registered-rules h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #374151;
}

.rule-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    background: white;
    border-radius: 4px;
    margin-bottom: 6px;
}

.rule-item input[type='radio'] {
    margin-top: 4px;
}

.rule-label {
    flex: 1;
    font-size: 13px;
    color: #4b5563;
    cursor: pointer;
}

.rule-label strong {
    color: #166534;
}

.remove-rule-btn {
    padding: 2px 8px;
    background: #fee2e2;
    color: #dc2626;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
}

.remove-rule-btn:hover {
    background: #fecaca;
}

.ai-run-btn {
    background: #10b981;
}

.ai-run-btn:hover:not(:disabled) {
    background: #059669;
}

.ai-results {
    border-color: #86efac;
}

.issue--ai {
    background: rgba(16, 185, 129, 0.1);
}

.ai-badge {
    background: #10b981;
    color: white;
}

.no-rules {
    color: #6b7280;
    font-size: 13px;
    font-style: italic;
    text-align: center;
    padding: 12px;
}

/* Features section */
.features {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
}

.features ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.features li {
    padding: 6px 0;
    font-size: 14px;
    color: #4b5563;
}

.features li strong {
    color: #374151;
}
</style>

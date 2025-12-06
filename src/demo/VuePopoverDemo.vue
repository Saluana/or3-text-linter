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
import { OpenRouter } from '@openrouter/sdk';
import { createNaturalLanguageRule } from '../factory/createNaturalLanguageRule';
import type { AITool } from '../types';

const STORAGE_KEY = 'openrouter_api_key';

const getApiKey = (): string | null => {
    return localStorage.getItem(STORAGE_KEY);
};

const openRouter = shallowRef<OpenRouter | null>(null);

// Editor instance ref - using shallowRef as recommended for Tiptap
const editor = shallowRef<Editor | null>(null);

// Sample content with known issues for demonstration
const sampleContent = `
<h1>How to Walk Your Dog: A Complete Guide</h1>

<p>Walking your dog is obviously one of the most important things you can do for your furry friend . It provides essential exercise , mental stimulation , and bonding time. This guide will clearly help you master the art of dog walking .</p>

<h2>Getting Ready for the Walk</h2>

<p>Before heading out , you simply need to gather a few essential items. Make sure you have:</p>

<ul>
<li>A sturdy leash (4-6 feet is ideal)</li>
<li>Waste bags for cleanup</li>
<li>Fresh water and a portable bowl</li>
<li>Treats for positive reinforcement</li>
</ul>

<p>Its also important to check the weather conditions . On hot days , the pavement can evidently burn your dogs paws , so test it with your hand first .</p>

<h4>Choosing the Right Time</h4>

<p>The best times for walking are early morning or late evening when temperatures are cooler . Avoid the midday sun , especially during summer months. Your dog will definately thank you for this consideration !</p>

<h2>During the Walk</h2>

<p>Keep your dog on a loose leash and let them sniff around - this is there way of exploring the world . However , maintain control and be aware of your surroundings. Watch out for:</p>

<ul>
<li>Other dogs that might be agressive</li>
<li>Traffic and busy intersections</li>
<li>Potential hazards like broken glass</li>
</ul>

<h6>Training Tips</h6>

<p>If your dog pulls on the leash , stop walking immediatly and wait for them to calm down. Reward good behaviour with treats and praise. Consistancy is key to developing good walking habits .</p>

<h2>After the Walk</h2>

<p>When you return home , check your dogs paws for any cuts or debris. Provide fresh water and let them rest. A tired dog is a happy dog , and regular walks will keep your companion healthy and well-behaved for years to come !</p>
`;

const aiProvider = async (
    systemPrompt: string,
    content: string,
    tools?: AITool[]
) => {
    if (!openRouter.value) {
        throw new Error('OpenRouter not initialized');
    }

    const data = await openRouter.value.chat.send({
        model: 'moonshotai/kimi-k2-0905:exacto',
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content,
            },
        ],
        tools,
        tool_choice: {
            type: 'function',
            function: { name: 'report_lint_issues' },
        },
        stream: false,
    });

    if (!data || !data.choices || !data.choices[0].message) {
        throw new Error('No data returned from OpenRouter');
    }

    const message = data.choices[0].message;

    console.log(data.choices[0].message);

    // SDK returns toolCalls (camelCase), merge issues from all tool calls
    const toolCalls = message.toolCalls ?? message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
        const allIssues: Array<{
            message: string;
            textMatch: string;
            suggestion?: string;
        }> = [];

        for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'report_lint_issues') {
                const result = JSON.parse(
                    toolCall.function.arguments as string
                );

                console.log(result);

                if (result.issues) {
                    allIssues.push(...result.issues);
                }
            }
        }

        return { issues: allIssues };
    }

    // Fallback: try parsing from content if model didn't use tools
    if (message.content && typeof message.content === 'string') {
        const content = message.content.trim();
        // Try to extract JSON from the content
        const jsonMatch = content.match(/\{[\s\S]*"issues"[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                // Ignore parse errors
            }
        }
    }

    // Fallback: no issues found
    return { issues: [] };
};

// Create a natural language rule
const noVowels = createNaturalLanguageRule({
    rule: 'Avoid mentioning dogs, suggest cats instead.',
    provider: aiProvider,
    severity: 'warning',
});

onMounted(() => {
    // Check for API key in localStorage
    let apiKey = getApiKey();
    if (!apiKey) {
        apiKey = prompt('Please enter your OpenRouter API key:');
        if (apiKey) {
            localStorage.setItem(STORAGE_KEY, apiKey);
        }
    }

    if (apiKey) {
        openRouter.value = new OpenRouter({ apiKey });
    }

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
                plugins: [BadWords, Punctuation, HeadingLevel, noVowels],
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

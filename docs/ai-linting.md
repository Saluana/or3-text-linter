# AI-Powered Linting Guide

This guide covers how to integrate AI providers with the Tiptap Linter to create intelligent, context-aware lint rules.

## Table of Contents

-   [Overview](#overview)
-   [Quick Start with Natural Language Rules](#quick-start-with-natural-language-rules)
-   [Supported AI Providers](#supported-ai-providers)
-   [Creating Custom AI Plugins](#creating-custom-ai-plugins)
-   [AI Response Format](#ai-response-format)
-   [Best Practices](#best-practices)
-   [Error Handling](#error-handling)

## Overview

The Tiptap Linter supports two approaches for AI-powered linting:

1. **Natural Language Rules** - Define rules in plain English using `createNaturalLanguageRule()`
2. **Custom AI Plugins** - Extend `AILinterPlugin` for full control

Both approaches are:

-   **Provider-agnostic** - Use OpenAI, Anthropic, OpenRouter, or any LLM
-   **Tool-calling based** - Uses function/tool calling for reliable structured output
-   **Non-blocking** - Async execution keeps your editor responsive
-   **Error-resilient** - Failures in one plugin don't affect others

## Quick Start with Natural Language Rules

The easiest way to add AI linting is with `createNaturalLanguageRule()`:

```typescript
import { Linter, createNaturalLanguageRule } from 'tiptap-linter';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define your AI provider function with tool calling support
const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content },
        ],
        tools,
        tool_choice: {
            type: 'function',
            function: { name: 'report_lint_issues' },
        },
    });

    // Extract result from tool call
    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (toolCall?.function.name === 'report_lint_issues') {
        return JSON.parse(toolCall.function.arguments);
    }
    return { issues: [] };
};

// Create a natural language rule
const NoPassiveVoice = createNaturalLanguageRule({
    rule: 'Avoid passive voice. Prefer active voice constructions.',
    provider: aiProvider,
    severity: 'warning',
});

// Use it with the Linter
const editor = new Editor({
    extensions: [
        StarterKit,
        Linter.configure({
            plugins: [NoPassiveVoice],
        }),
    ],
});
```

## Supported AI Providers

### OpenAI

```typescript
import OpenAI from 'openai';
import type { AITool } from 'tiptap-linter';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content },
        ],
        tools,
        tool_choice: {
            type: 'function',
            function: { name: 'report_lint_issues' },
        },
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (toolCall?.function.name === 'report_lint_issues') {
        return JSON.parse(toolCall.function.arguments);
    }
    return { issues: [] };
};
```

### Anthropic (Claude)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { AITool } from 'tiptap-linter';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    // Convert tools to Anthropic format
    const anthropicTools = tools?.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
    }));

    const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        system: prompt,
        messages: [{ role: 'user', content }],
        tools: anthropicTools,
        tool_choice: { type: 'tool', name: 'report_lint_issues' },
    });

    // Extract from tool use block
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (toolUse && toolUse.type === 'tool_use') {
        return toolUse.input as {
            issues: Array<{
                message: string;
                textMatch: string;
                suggestion?: string;
            }>;
        };
    }
    return { issues: [] };
};
```

### OpenRouter

```typescript
import { OpenRouter } from '@openrouter/sdk';
import type { AITool } from 'tiptap-linter';

const openRouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    const response = await openRouter.chat.send({
        model: 'openai/gpt-4',
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content },
        ],
        tools,
        tool_choice: {
            type: 'function',
            function: { name: 'report_lint_issues' },
        },
        stream: false,
    });

    // Handle both camelCase (SDK) and snake_case (API) responses
    const toolCalls =
        response.choices[0].message.toolCalls ??
        response.choices[0].message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
        // Merge issues from all tool calls (some models may split responses)
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
                if (result.issues) {
                    allIssues.push(...result.issues);
                }
            }
        }
        return { issues: allIssues };
    }
    return { issues: [] };
};
```

### Vercel AI SDK

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { AITool } from 'tiptap-linter';

const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    // Convert to Vercel AI SDK tool format
    const aiTools = tools?.reduce((acc, t) => {
        acc[t.function.name] = {
            description: t.function.description,
            parameters: t.function.parameters,
        };
        return acc;
    }, {} as Record<string, unknown>);

    const { toolCalls } = await generateText({
        model: openai('gpt-4'),
        system: prompt,
        prompt: content,
        tools: aiTools,
        toolChoice: { type: 'tool', toolName: 'report_lint_issues' },
    });

    const call = toolCalls.find((c) => c.toolName === 'report_lint_issues');
    if (call) {
        return call.args as {
            issues: Array<{
                message: string;
                textMatch: string;
                suggestion?: string;
            }>;
        };
    }
    return { issues: [] };
};
```

## Creating Custom AI Plugins

For more control, extend the `AILinterPlugin` class:

```typescript
import { AILinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { AILinterPluginConfig } from 'tiptap-linter';

export class GrammarChecker extends AILinterPlugin {
    constructor(doc: ProsemirrorNode, config: AILinterPluginConfig) {
        super(doc, config);
    }

    async scan(): Promise<this> {
        const { fullText, segments } = this.extractTextWithPositions();

        if (!fullText.trim()) {
            return this;
        }

        try {
            const response = await this.config.provider(
                this.config.systemPrompt || 'Check for grammar errors.',
                fullText
                // You can pass custom tools here if needed
            );

            this.parseAIResponse(response, segments, fullText);
        } catch (error) {
            console.error('Grammar check failed:', error);
        }

        return this;
    }
}
```

### AILinterPlugin Methods

```typescript
class AILinterPlugin extends LinterPlugin {
    // Extract document text with position mapping
    protected extractTextWithPositions(): {
        fullText: string;
        segments: TextSegment[];
    };

    // Find ProseMirror position of text in document
    protected findTextPosition(
        textMatch: string,
        segments: TextSegment[],
        fullText: string
    ): { from: number; to: number } | null;

    // Create a fix function from replacement text
    protected createTextFix(replacement: string): FixFn;

    // Parse AI response and record issues
    protected parseAIResponse(
        response: unknown,
        segments: TextSegment[],
        fullText: string
    ): void;
}
```

## AI Response Format

The AI provider must return this structure (extracted from tool call arguments):

```typescript
interface AIResponse {
    issues: Array<{
        message: string; // Human-readable description
        textMatch: string; // Exact text to highlight (must match document)
        suggestion?: string; // Optional replacement text for auto-fix
    }>;
}
```

### Tool Definition

The linter provides this tool definition to your AI provider:

```typescript
{
    type: 'function',
    function: {
        name: 'report_lint_issues',
        description: 'Report lint issues found in the text based on the rule provided',
        parameters: {
            type: 'object',
            properties: {
                issues: {
                    type: 'array',
                    description: 'Array of lint issues found in the text',
                    items: {
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                description: 'A clear explanation of what violates the rule'
                            },
                            textMatch: {
                                type: 'string',
                                description: 'The exact text that violates the rule (must match exactly)'
                            },
                            suggestion: {
                                type: 'string',
                                description: 'Optional suggested replacement text'
                            }
                        },
                        required: ['message', 'textMatch']
                    }
                }
            },
            required: ['issues']
        }
    }
}
```

### Example Tool Call Response

```json
{
    "tool_calls": [
        {
            "function": {
                "name": "report_lint_issues",
                "arguments": "{\"issues\": [{\"message\": \"Passive voice detected\", \"textMatch\": \"was written by the team\", \"suggestion\": \"the team wrote\"}]}"
            }
        }
    ]
}
```

## Best Practices

### 1. Use Debouncing

Prevent excessive API calls with debouncing:

```typescript
const NoJargon = createNaturalLanguageRule({
    rule: 'Avoid technical jargon. Use simple, clear language.',
    provider: aiProvider,
    debounceMs: 1000, // Wait 1 second after typing stops
});
```

### 2. Choose Appropriate Models

-   **GPT-4 / Claude 3 Opus**: Best accuracy, higher cost
-   **GPT-4o-mini / Claude 3 Haiku**: Good balance of speed and accuracy
-   Models must support tool/function calling

### 3. Keep Prompts Focused

```typescript
// ✅ Good - specific and focused
const rule = 'Sentences should not exceed 25 words.';

// ❌ Bad - too broad
const rule = 'Make the writing better.';
```

### 4. Handle Rate Limits

```typescript
const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content },
            ],
            tools,
            tool_choice: {
                type: 'function',
                function: { name: 'report_lint_issues' },
            },
        });
        // ... extract tool call result
    } catch (error) {
        if (error.status === 429) {
            console.warn('Rate limited, skipping AI check');
            return { issues: [] };
        }
        throw error;
    }
};
```

### 5. Cache Results

```typescript
const cache = new Map<string, AIResponse>();

const cachedProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    const key = `${prompt}:${content}`;

    if (cache.has(key)) {
        return cache.get(key)!;
    }

    const response = await aiProvider(prompt, content, tools);
    cache.set(key, response);

    return response;
};
```

## Error Handling

The linter handles AI errors gracefully:

```typescript
// Errors in one plugin don't affect others
Linter.configure({
    plugins: [
        BadWords, // Sync plugin - always runs
        NoPassiveVoice, // AI plugin - may fail
        Punctuation, // Sync plugin - always runs
    ],
});

// If NoPassiveVoice fails, BadWords and Punctuation still work
```

### Custom Error Handling

```typescript
class RobustAIPlugin extends AILinterPlugin {
    async scan(): Promise<this> {
        const { fullText, segments } = this.extractTextWithPositions();

        try {
            const response = await this.config.provider(
                this.config.systemPrompt!,
                fullText
            );
            this.parseAIResponse(response, segments, fullText);
        } catch (error) {
            console.error('AI plugin error:', error);

            // Optionally record a meta-issue
            this.record(
                'AI check unavailable - please try again later',
                0,
                1,
                'info'
            );
        }

        return this;
    }
}
```

## Example: Complete AI Linting Setup

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
    Linter,
    BadWords,
    Punctuation,
    createNaturalLanguageRule,
} from 'tiptap-linter';
import type { AITool } from 'tiptap-linter';
import OpenAI from 'openai';

// Setup OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const aiProvider = async (
    prompt: string,
    content: string,
    tools?: AITool[]
) => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content },
        ],
        tools,
        tool_choice: {
            type: 'function',
            function: { name: 'report_lint_issues' },
        },
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (toolCall?.function.name === 'report_lint_issues') {
        return JSON.parse(toolCall.function.arguments);
    }
    return { issues: [] };
};

// Create AI rules
const NoPassiveVoice = createNaturalLanguageRule({
    rule: 'Avoid passive voice. Use active voice instead.',
    provider: aiProvider,
    severity: 'warning',
    debounceMs: 1000,
});

const ClearLanguage = createNaturalLanguageRule({
    rule: 'Use clear, simple language. Avoid jargon and complex sentences.',
    provider: aiProvider,
    severity: 'info',
    debounceMs: 1000,
});

// Create editor with all plugins
const editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [
        StarterKit,
        Linter.configure({
            plugins: [
                // Sync plugins (instant)
                BadWords,
                Punctuation,
                // AI plugins (async)
                NoPassiveVoice,
                ClearLanguage,
            ],
            popover: {
                placement: 'bottom',
                showFixButton: true,
            },
        }),
    ],
});
```

## Next Steps

-   [Creating Custom Plugins](./creating-plugins.md) - Build sync plugins
-   [Popover Customization](./popover-customization.md) - Customize the UI
-   [API Reference](./api-reference.md) - Complete API documentation

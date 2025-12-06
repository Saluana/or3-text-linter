import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { AILinterPlugin } from '../extension/AILinterPlugin';
import type {
    AIProviderFn,
    AITool,
    Severity,
    AsyncLinterPluginClass,
} from '../types';

/**
 * Configuration for creating a natural language lint rule.
 *
 * Requirements: 16.1, 17.1, 17.2, 17.3
 */
export interface NaturalLanguageRuleConfig {
    /** Plain English rule description (Required - Requirement 16.1) */
    rule: string;
    /** User-provided function that calls their chosen AI provider (Required - Requirement 17.2) */
    provider: AIProviderFn;
    /** Default severity for issues found by this rule (Optional - Requirement 17.3) */
    severity?: Severity;
}

/**
 * Generates a system prompt that instructs the AI to find violations of the natural language rule.
 *
 * Requirement 17.5: Use a system prompt that instructs the AI to find violations
 *
 * @param rule - The plain English rule description
 * @returns System prompt string for the AI
 */
function generateSystemPrompt(rule: string): string {
    return `You are a precise text linter. Check the text for violations of this rule:

"${rule}"

CRITICAL REQUIREMENTS:
1. Report EACH violation separately - do NOT combine multiple violations into one issue
2. textMatch MUST be copied EXACTLY from the input text (character-for-character, including punctuation and spacing)
3. textMatch should be the minimal text that violates the rule (e.g., just "your dog" not the whole sentence)
4. suggestion should be a direct replacement for textMatch only
5. If the same text appears multiple times, use occurrenceIndex (0-indexed) to specify which one

Example - if the rule is "avoid mentioning dogs" and text contains "Walk your dog. Feed your dog.":
- First occurrence: textMatch="your dog", occurrenceIndex=0, suggestion="your cat"
- Second occurrence: textMatch="your dog", occurrenceIndex=1, suggestion="your cat"

If no violations found, report empty issues array.`;
}

/**
 * Tool definition for structured lint issue reporting.
 * Using tool calling provides more reliable structured output than JSON in content.
 */
const LINT_TOOLS: AITool[] = [
    {
        type: 'function',
        function: {
            name: 'report_lint_issues',
            description:
                'Report lint issues found in the text based on the rule provided',
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
                                    description:
                                        'A clear explanation of what violates the rule',
                                },
                                textMatch: {
                                    type: 'string',
                                    description:
                                        'The exact text that violates the rule (must match exactly as it appears)',
                                },
                                suggestion: {
                                    type: 'string',
                                    description:
                                        'Optional suggested replacement text to fix the violation',
                                },
                                occurrenceIndex: {
                                    type: 'number',
                                    description:
                                        'Which occurrence of textMatch to highlight (0-indexed). Use when the same text appears multiple times. Default is 0 (first occurrence).',
                                },
                            },
                            required: ['message', 'textMatch'],
                        },
                    },
                },
                required: ['issues'],
            },
        },
    },
];

/**
 * Factory function to create AI lint plugins from plain English descriptions.
 *
 * Requirements: 16.1, 16.2, 17.1, 17.2, 17.3, 17.4, 17.5
 *
 * @param config - Configuration object with rule description and AI provider
 * @returns A class extending AILinterPlugin that can be used with the Linter extension
 *
 * @example
 * ```typescript
 * const NoPassiveVoice = createNaturalLanguageRule({
 *   rule: "Avoid passive voice. Prefer active voice constructions.",
 *   provider: async (prompt, content, tools) => {
 *     const response = await openai.chat.completions.create({
 *       model: "gpt-4",
 *       messages: [
 *         { role: "system", content: prompt },
 *         { role: "user", content }
 *       ],
 *       tools,
 *       tool_choice: { type: "function", function: { name: "report_lint_issues" } }
 *     });
 *     const toolCall = response.choices[0].message.tool_calls?.[0];
 *     if (toolCall?.function.name === "report_lint_issues") {
 *       return JSON.parse(toolCall.function.arguments);
 *     }
 *     return { issues: [] };
 *   },
 *   severity: 'warning'
 * });
 * ```
 */
export function createNaturalLanguageRule(
    config: NaturalLanguageRuleConfig
): AsyncLinterPluginClass {
    const { rule, provider, severity = 'warning' } = config;
    const systemPrompt = generateSystemPrompt(rule);

    /**
     * Dynamic AILinterPlugin class created from the natural language rule.
     */
    class NaturalLanguageRulePlugin extends AILinterPlugin {
        constructor(doc: ProsemirrorNode) {
            super(doc, {
                provider,
                systemPrompt,
                severity,
            });
        }

        /**
         * Scan the document for violations of the natural language rule.
         *
         * Requirements: 16.2, 17.5
         */
        async scan(): Promise<this> {
            // Extract text content from the document
            const { fullText, segments } = this.extractTextWithPositions();

            // Skip if document is empty
            if (!fullText.trim()) {
                return this;
            }

            try {
                // Call the AI provider with the system prompt and document content
                // Requirement 16.2: Send rule description and document text to AI provider
                // Requirement 17.5: Use system prompt that instructs AI to find violations
                const prompt =
                    this.config.systemPrompt || generateSystemPrompt(rule);
                const response = await this.config.provider(
                    prompt,
                    fullText,
                    LINT_TOOLS
                );

                // Parse the AI response and record issues
                this.parseAIResponse(response, segments, fullText);
            } catch (error) {
                // Silently fail - AI errors shouldn't crash the linter
                if (process.env.NODE_ENV !== 'production') {
                    console.error(
                        '[Tiptap Linter] Natural language rule scan failed:',
                        error
                    );
                }
            }

            return this;
        }
    }

    return NaturalLanguageRulePlugin as AsyncLinterPluginClass;
}

import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { AILinterPlugin } from '../extension/AILinterPlugin';
import type { AIProviderFn, Severity, AsyncLinterPluginClass } from '../types';

/**
 * Configuration for creating a natural language lint rule.
 *
 * Requirements: 16.1, 17.1, 17.2, 17.3, 17.4
 */
export interface NaturalLanguageRuleConfig {
    /** Plain English rule description (Required - Requirement 16.1) */
    rule: string;
    /** User-provided function that calls their chosen AI provider (Required - Requirement 17.2) */
    provider: AIProviderFn;
    /** Default severity for issues found by this rule (Optional - Requirement 17.3) */
    severity?: Severity;
    /** Debounce timing in milliseconds to limit API calls (Optional - Requirement 17.4) */
    debounceMs?: number;
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
    return `You are a writing assistant that checks text for violations of the following rule:

"${rule}"

Analyze the provided text and identify any violations of this rule. For each violation found, respond with a JSON object containing an "issues" array. Each issue should have:
- "message": A clear explanation of what violates the rule
- "textMatch": The exact text that violates the rule (must match exactly as it appears in the document)
- "suggestion": (optional) A suggested replacement text that would fix the violation

If no violations are found, return: {"issues": []}

Respond ONLY with valid JSON, no additional text.`;
}

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
 *   provider: async (prompt, content) => {
 *     const response = await openai.chat.completions.create({
 *       model: "gpt-4",
 *       messages: [
 *         { role: "system", content: prompt },
 *         { role: "user", content }
 *       ]
 *     });
 *     return JSON.parse(response.choices[0].message.content);
 *   },
 *   severity: 'warning'
 * });
 * ```
 */
export function createNaturalLanguageRule(
    config: NaturalLanguageRuleConfig
): AsyncLinterPluginClass {
    const { rule, provider, severity = 'warning', debounceMs } = config;
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
                debounceMs,
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
                const response = await this.config.provider(
                    this.config.systemPrompt!,
                    fullText
                );

                // Parse the AI response and record issues
                this.parseAIResponse(response, segments, fullText);
            } catch (error) {
                // Silently fail - AI errors shouldn't crash the linter
                console.error('Natural language rule scan failed:', error);
            }

            return this;
        }
    }

    return NaturalLanguageRulePlugin as unknown as AsyncLinterPluginClass;
}

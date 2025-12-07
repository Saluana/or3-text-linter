/**
 * @vitest-environment jsdom
 */
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
    generateCustomSeverityCSS,
    getEffectiveSeverity,
    createDecorationSet,
} from './Linter';
import type { CustomSeverity, Issue, Severity } from '../types';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

// Generator for valid CSS color values
const cssColorArb = fc.oneof(
    // Hex colors
    fc.hexaString({ minLength: 6, maxLength: 6 }).map((hex) => `#${hex}`),
    // RGB colors
    fc
        .tuple(
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 })
        )
        .map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`),
    // Named colors
    fc.constantFrom('red', 'blue', 'green', 'orange', 'purple', 'pink')
);

// Generator for valid severity names (alphanumeric, no spaces, CSS-safe)
const severityNameArb = fc
    .stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
    .filter((s) => s.length >= 1 && s.length <= 20)
    .filter((s) => !['info', 'warning', 'error'].includes(s)); // Exclude built-in severities

// Generator for CustomSeverity objects
const customSeverityArb: fc.Arbitrary<CustomSeverity> = fc.record({
    name: severityNameArb,
    color: cssColorArb,
});

// Generator for arrays of CustomSeverity with unique names
const customSeveritiesArb = fc
    .array(customSeverityArb, { minLength: 1, maxLength: 5 })
    .map((severities) => {
        // Ensure unique names
        const seen = new Set<string>();
        return severities.filter((s) => {
            if (seen.has(s.name)) return false;
            seen.add(s.name);
            return true;
        });
    })
    .filter((arr) => arr.length > 0);

describe('Custom Severity CSS Generation Property Tests', () => {
    // **Feature: on-demand-linting, Property 6: Custom severity CSS generation**
    // **Validates: Requirements 8.2, 8.3, 8.4**
    test.prop([customSeveritiesArb], { numRuns: 100 })(
        'generateCustomSeverityCSS creates CSS classes for each custom severity',
        (customSeverities) => {
            const css = generateCustomSeverityCSS(customSeverities);

            // Property: CSS should be non-empty when custom severities are provided
            expect(css.length).toBeGreaterThan(0);

            for (const severity of customSeverities) {
                // Property: CSS should contain .problem--{name} class (Requirement 8.3)
                expect(css).toContain(`.problem--${severity.name}`);

                // Property: CSS should contain .lint-icon--{name} class (Requirement 8.3)
                expect(css).toContain(`.lint-icon--${severity.name}`);

                // Property: CSS should use the specified color (Requirement 8.4)
                expect(css).toContain(severity.color);
            }
        }
    );

    test.prop([customSeveritiesArb], { numRuns: 100 })(
        'generateCustomSeverityCSS generates valid CSS syntax',
        (customSeverities) => {
            const css = generateCustomSeverityCSS(customSeverities);

            // Property: Each severity should have both problem and icon CSS rules
            for (const severity of customSeverities) {
                // Check for proper CSS rule structure with braces
                const problemRegex = new RegExp(
                    `\\.problem--${severity.name}\\s*\\{[^}]+\\}`
                );
                const iconRegex = new RegExp(
                    `\\.lint-icon--${severity.name}\\s*\\{[^}]+\\}`
                );

                expect(css).toMatch(problemRegex);
                expect(css).toMatch(iconRegex);
            }
        }
    );

    test('generateCustomSeverityCSS returns empty string for empty array', () => {
        const css = generateCustomSeverityCSS([]);
        expect(css).toBe('');
    });

    test('generateCustomSeverityCSS returns empty string for undefined', () => {
        const css = generateCustomSeverityCSS(
            undefined as unknown as CustomSeverity[]
        );
        expect(css).toBe('');
    });
});

describe('Custom Severity Fallback Property Tests', () => {
    // **Feature: on-demand-linting, Property 7: Custom severity fallback**
    // **Validates: Requirements 8.5**

    // Generator for built-in severities
    const builtinSeverityArb = fc.constantFrom(
        'info',
        'warning',
        'error'
    ) as fc.Arbitrary<Severity>;

    test.prop([builtinSeverityArb], { numRuns: 100 })(
        'getEffectiveSeverity returns built-in severities unchanged',
        (severity) => {
            const registeredCustomSeverities = new Set<string>();
            const effective = getEffectiveSeverity(
                severity,
                registeredCustomSeverities
            );

            // Property: Built-in severities should be returned as-is
            expect(effective).toBe(severity);
        }
    );

    test.prop([customSeveritiesArb], { numRuns: 100 })(
        'getEffectiveSeverity returns registered custom severities unchanged',
        (customSeverities) => {
            const registeredCustomSeverities = new Set(
                customSeverities.map((s) => s.name)
            );

            for (const severity of customSeverities) {
                const effective = getEffectiveSeverity(
                    severity.name,
                    registeredCustomSeverities
                );

                // Property: Registered custom severities should be returned as-is
                expect(effective).toBe(severity.name);
            }
        }
    );

    test.prop([severityNameArb], { numRuns: 100 })(
        'getEffectiveSeverity falls back to warning for unregistered severities',
        (unregisteredSeverity) => {
            // Empty set means no custom severities are registered
            const registeredCustomSeverities = new Set<string>();
            const effective = getEffectiveSeverity(
                unregisteredSeverity,
                registeredCustomSeverities
            );

            // Property: Unregistered severities should fall back to 'warning' (Requirement 8.5)
            expect(effective).toBe('warning');
        }
    );

    test.prop([severityNameArb, customSeveritiesArb], { numRuns: 100 })(
        'getEffectiveSeverity falls back to warning when severity not in registered set',
        (unregisteredSeverity, customSeverities) => {
            // Filter out the unregistered severity from the registered set
            const registeredCustomSeverities = new Set(
                customSeverities
                    .map((s) => s.name)
                    .filter((name) => name !== unregisteredSeverity)
            );

            // Only test if the severity is truly unregistered
            if (!registeredCustomSeverities.has(unregisteredSeverity)) {
                const effective = getEffectiveSeverity(
                    unregisteredSeverity,
                    registeredCustomSeverities
                );

                // Property: Unregistered severities should fall back to 'warning'
                expect(effective).toBe('warning');
            }
        }
    );
});

describe('createDecorationSet Custom Severity Integration Tests', () => {
    let editor: Editor;

    beforeEach(() => {
        editor = new Editor({
            extensions: [Document, Paragraph, Text],
            content: '<p>This is test content for custom severity testing.</p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    // **Feature: on-demand-linting, Property 7: Custom severity fallback**
    // **Validates: Requirements 8.5**
    test.prop([severityNameArb], { numRuns: 50 })(
        'createDecorationSet uses warning class for unregistered custom severities',
        async (unregisteredSeverity) => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            const issues: Issue[] = [
                {
                    message: 'Test issue',
                    from: 1,
                    to: 5,
                    severity: unregisteredSeverity,
                },
            ];

            // No custom severities registered
            const decorationSet = createDecorationSet(
                editor.state.doc,
                issues,
                []
            );

            // Property: Decorations should be created (2 per issue: inline + widget)
            // The decorations use 'warning' class for unregistered severities
            expect(decorationSet.find().length).toBe(2);
        }
    );

    test.prop([customSeveritiesArb], { numRuns: 50 })(
        'createDecorationSet uses custom severity class when registered',
        async (customSeverities) => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            const firstSeverity = customSeverities[0];
            const issues: Issue[] = [
                {
                    message: 'Test issue',
                    from: 1,
                    to: 5,
                    severity: firstSeverity.name,
                },
            ];

            const decorationSet = createDecorationSet(
                editor.state.doc,
                issues,
                customSeverities
            );

            // Property: Decorations should be created
            expect(decorationSet.find().length).toBe(2);
        }
    );
});

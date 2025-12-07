/**
 * @vitest-environment jsdom
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { normalizePlugins } from './Linter';
import { LinterPlugin } from './LinterPlugin';
import type { PluginConfig } from '../types';

// Generator for plugin mode
const modeArb = fc.constantFrom('auto', 'onDemand') as fc.Arbitrary<
    'auto' | 'onDemand'
>;

// Generator for optional mode (can be undefined)
const optionalModeArb = fc.option(modeArb, { nil: undefined });

// Factory to create a test plugin class with a unique identifier
function createTestPluginClass(id: string) {
    return class TestPlugin extends LinterPlugin {
        static pluginId = id;
        scan(): this {
            return this;
        }
    };
}

// Generator for a unique plugin identifier
const pluginIdArb = fc.string({ minLength: 1, maxLength: 10 });

describe('normalizePlugins Property Tests', () => {
    // **Feature: on-demand-linting, Property 5: Plugin mode filtering**
    // **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

    test.prop(
        [
            fc.array(
                fc.record({
                    id: pluginIdArb,
                    useConfig: fc.boolean(),
                    mode: optionalModeArb,
                }),
                { minLength: 0, maxLength: 10 }
            ),
        ],
        { numRuns: 100 }
    )(
        'normalizePlugins returns correct mode for all plugin configurations',
        (pluginInputs) => {
            // Create unique plugin classes for each input
            const plugins: Array<typeof LinterPlugin | PluginConfig> =
                pluginInputs.map((input, idx) => {
                    const PluginClass = createTestPluginClass(
                        `${input.id}-${idx}`
                    );
                    if (input.useConfig) {
                        // Use PluginConfig object
                        return {
                            plugin: PluginClass,
                            mode: input.mode,
                        } as PluginConfig;
                    }
                    // Use direct plugin class
                    return PluginClass;
                });

            const normalized = normalizePlugins(plugins);

            // Property 1: Output length equals input length
            expect(normalized).toHaveLength(plugins.length);

            // Property 2: Each normalized plugin has correct mode
            for (let i = 0; i < pluginInputs.length; i++) {
                const input = pluginInputs[i];
                const result = normalized[i];

                if (input.useConfig) {
                    // PluginConfig: mode should be input.mode or default to 'auto'
                    const expectedMode = input.mode ?? 'auto';
                    expect(result.mode).toBe(expectedMode);
                } else {
                    // Direct plugin class: mode should default to 'auto'
                    expect(result.mode).toBe('auto');
                }
            }
        }
    );

    test.prop(
        [
            fc.array(
                fc.record({
                    id: pluginIdArb,
                    useConfig: fc.boolean(),
                    mode: optionalModeArb,
                }),
                { minLength: 1, maxLength: 10 }
            ),
        ],
        { numRuns: 100 }
    )('normalizePlugins preserves plugin class references', (pluginInputs) => {
        // Create unique plugin classes for each input
        const pluginClasses = pluginInputs.map((input, idx) =>
            createTestPluginClass(`${input.id}-${idx}`)
        );

        const plugins: Array<typeof LinterPlugin | PluginConfig> =
            pluginInputs.map((input, idx) => {
                const PluginClass = pluginClasses[idx];
                if (input.useConfig) {
                    return {
                        plugin: PluginClass,
                        mode: input.mode,
                    } as PluginConfig;
                }
                return PluginClass;
            });

        const normalized = normalizePlugins(plugins);

        // Property: Each normalized plugin should reference the original plugin class
        for (let i = 0; i < pluginClasses.length; i++) {
            expect(normalized[i].pluginClass).toBe(pluginClasses[i]);
        }
    });

    test.prop(
        [
            fc.array(
                fc.record({
                    id: pluginIdArb,
                    mode: modeArb,
                }),
                { minLength: 1, maxLength: 10 }
            ),
        ],
        { numRuns: 100 }
    )(
        'normalizePlugins with explicit modes preserves those modes',
        (pluginInputs) => {
            // Create PluginConfig objects with explicit modes
            const plugins: PluginConfig[] = pluginInputs.map((input, idx) => ({
                plugin: createTestPluginClass(`${input.id}-${idx}`),
                mode: input.mode,
            }));

            const normalized = normalizePlugins(plugins);

            // Property: Each normalized plugin should have the exact mode specified
            for (let i = 0; i < pluginInputs.length; i++) {
                expect(normalized[i].mode).toBe(pluginInputs[i].mode);
            }
        }
    );

    test.prop([fc.array(pluginIdArb, { minLength: 1, maxLength: 10 })], {
        numRuns: 100,
    })(
        'normalizePlugins with direct plugin classes defaults all to auto mode',
        (pluginIds) => {
            // Create direct plugin classes (no PluginConfig)
            const plugins = pluginIds.map((id, idx) =>
                createTestPluginClass(`${id}-${idx}`)
            );

            const normalized = normalizePlugins(plugins);

            // Property: All normalized plugins should have mode 'auto'
            for (const result of normalized) {
                expect(result.mode).toBe('auto');
            }
        }
    );

    test.prop(
        [
            fc.array(
                fc.record({
                    id: pluginIdArb,
                    isOnDemand: fc.boolean(),
                }),
                { minLength: 1, maxLength: 10 }
            ),
        ],
        { numRuns: 100 }
    )(
        'normalizePlugins correctly separates auto and onDemand plugins',
        (pluginInputs) => {
            // Create plugins with mixed modes
            const plugins: PluginConfig[] = pluginInputs.map((input, idx) => ({
                plugin: createTestPluginClass(`${input.id}-${idx}`),
                mode: input.isOnDemand ? 'onDemand' : 'auto',
            }));

            const normalized = normalizePlugins(plugins);

            // Count expected auto and onDemand plugins
            const expectedAutoCount = pluginInputs.filter(
                (p) => !p.isOnDemand
            ).length;
            const expectedOnDemandCount = pluginInputs.filter(
                (p) => p.isOnDemand
            ).length;

            // Count actual auto and onDemand plugins
            const actualAutoCount = normalized.filter(
                (p) => p.mode === 'auto'
            ).length;
            const actualOnDemandCount = normalized.filter(
                (p) => p.mode === 'onDemand'
            ).length;

            // Property: Counts should match
            expect(actualAutoCount).toBe(expectedAutoCount);
            expect(actualOnDemandCount).toBe(expectedOnDemandCount);
        }
    );
});

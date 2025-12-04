import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        exclude: ['**/node_modules/**', '**/dist/**', 'src/demo/**'],
        environment: 'jsdom',
        testTimeout: 30000, // 30 seconds for property tests with async operations
    },
});

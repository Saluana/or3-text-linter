import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            '*.config.js',
            '*.config.ts',
            'coverage/**',
        ],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            // TypeScript-specific rules
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'off',
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',

            // General rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-arrow-callback': 'error',
            'no-throw-literal': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];

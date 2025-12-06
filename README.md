**WARNING**: This project is highly experimental and not production-ready. Things will change rapidly.

# Tiptap Linter

A comprehensive, extensible linting solution for [Tiptap](https://tiptap.dev/) and ProseMirror editors. Detect writing issues, enforce style guidelines, and provide automatic fixes—all with a beautiful, customizable UI.

## Features

-   🔍 **Configurable Lint Plugins** - Use built-in plugins or create your own
-   🎨 **Severity Levels** - Info, warning, and error with distinct visual styling
-   🔧 **Automatic Fixes** - One-click fixes for detected issues
-   💬 **Customizable Popovers** - Beautiful default UI or bring your own renderer
-   🤖 **AI-Powered Linting** - Integrate with OpenAI, Anthropic, or any LLM provider
-   📝 **Natural Language Rules** - Create lint rules in plain English
-   ⚡ **Async Support** - Non-blocking AI linting that keeps your editor responsive

## Installation

```bash
# Using bun
bun add tiptap-linter

# Using npm
npm install tiptap-linter

# Using yarn
yarn add tiptap-linter
```

## Quick Start

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Linter, BadWords, Punctuation, HeadingLevel } from 'tiptap-linter';

const editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [
        StarterKit,
        Linter.configure({
            plugins: [BadWords, Punctuation, HeadingLevel],
            popover: {
                placement: 'bottom',
                showSeverity: true,
                showFixButton: true,
            },
        }),
    ],
    content: '<p>This is obviously a test document .</p>',
});
```

## Built-in Plugins

### BadWords

Detects discouraged words like "obviously", "clearly", "evidently", and "simply".

```typescript
import { BadWords } from 'tiptap-linter';

Linter.configure({
    plugins: [BadWords],
});
```

### Punctuation

Detects and fixes suspicious punctuation spacing (e.g., spaces before commas).

```typescript
import { Punctuation } from 'tiptap-linter';

Linter.configure({
    plugins: [Punctuation],
});
```

### HeadingLevel

Detects heading level jumps (e.g., H1 → H3) and suggests fixes.

```typescript
import { HeadingLevel } from 'tiptap-linter';

Linter.configure({
    plugins: [HeadingLevel],
});
```

## Creating Custom Plugins

Extend the `LinterPlugin` class to create your own lint rules:

```typescript
import { LinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

class NoExclamations extends LinterPlugin {
    constructor(doc: ProsemirrorNode) {
        super(doc);
    }

    scan(): this {
        const regex = /!/g;

        this.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                regex.lastIndex = 0;
                let match;
                while ((match = regex.exec(node.text)) !== null) {
                    const from = pos + match.index;
                    const to = from + 1;
                    this.record(
                        'Avoid exclamation marks in formal writing',
                        from,
                        to,
                        'info'
                    );
                }
            }
        });

        return this;
    }
}
```

## AI-Powered Linting

Create lint rules using natural language with any AI provider:

```typescript
import { createNaturalLanguageRule } from 'tiptap-linter';

const NoPassiveVoice = createNaturalLanguageRule({
    rule: 'Avoid passive voice. Prefer active voice constructions.',
    provider: async (prompt, content) => {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content },
            ],
        });
        return JSON.parse(response.choices[0].message.content);
    },
    severity: 'warning',
});

Linter.configure({
    plugins: [NoPassiveVoice],
});
```

## Popover Customization

### Default Popover

The default popover shows severity, message, and action buttons:

```typescript
Linter.configure({
    plugins: [BadWords],
    popover: {
        placement: 'bottom', // 'top' | 'bottom' | 'left' | 'right'
        showSeverity: true,
        showFixButton: true,
        style: {
            background: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
    },
});
```

### Custom Popover Renderer

Create your own popover UI:

```typescript
import type { PopoverContext } from 'tiptap-linter';

function MyCustomPopover(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'my-popover';

    for (const issue of context.issues) {
        const el = document.createElement('div');
        el.innerHTML = `
      <strong>${issue.severity}</strong>: ${issue.message}
      <button class="fix-btn">Fix</button>
      <button class="dismiss-btn">×</button>
    `;

        el.querySelector('.fix-btn')?.addEventListener('click', () => {
            context.actions.applyFix();
        });

        el.querySelector('.dismiss-btn')?.addEventListener('click', () => {
            context.actions.dismiss();
        });

        container.appendChild(el);
    }

    return container;
}

Linter.configure({
    plugins: [BadWords],
    popover: {
        renderer: MyCustomPopover,
    },
});
```

## Accessing Issues Programmatically

```typescript
// Get all current issues
const issues = editor.storage.linter.getIssues();

// Display in a sidebar
issues.forEach((issue) => {
    console.log(
        `${issue.severity}: ${issue.message} (${issue.from}-${issue.to})`
    );
});
```

## CSS Styling

Add these styles to customize the appearance:

```css
/* Inline highlights */
.problem {
    background-color: rgba(255, 220, 0, 0.3);
}

.problem--info {
    background-color: rgba(0, 150, 255, 0.2);
}

.problem--warning {
    background-color: rgba(255, 220, 0, 0.3);
}

.problem--error {
    background-color: rgba(255, 0, 0, 0.2);
}

/* Lint icons */
.lint-icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    cursor: pointer;
    border-radius: 50%;
}

.lint-icon--info {
    background-color: #0096ff;
}

.lint-icon--warning {
    background-color: #ffdc00;
}

.lint-icon--error {
    background-color: #ff4444;
}

/* Popover */
.lint-popover {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
}

.lint-popover__severity {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
}

.lint-popover__message {
    margin: 8px 0;
}

.lint-popover__btn {
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
}

.lint-popover__btn--fix {
    background: #4caf50;
    color: white;
    border: none;
}

.lint-popover__btn--dismiss {
    background: transparent;
    border: 1px solid #ccc;
}
```

## Documentation

-   [Creating Custom Plugins](./docs/creating-plugins.md) - Step-by-step tutorial
-   [AI Linting Guide](./docs/ai-linting.md) - Integrate AI providers
-   [API Reference](./docs/api-reference.md) - Complete API documentation
-   [Popover Customization](./docs/popover-customization.md) - Custom UI guide

## Development

### Prerequisites

-   Node.js 18+ or Bun
-   npm, yarn, or bun package manager

### Setup

```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

### Code Quality

This project maintains strict code quality standards:

-   **TypeScript strict mode** enabled for maximum type safety
-   **ESLint** with zero-warnings policy - all code must pass linting
-   **No `any` types** - explicit typing required throughout the codebase
-   **Property-based testing** with fast-check for robust test coverage

Run `npm run lint` before committing to ensure your code meets quality standards.

## License

MIT

## Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) before submitting a PR.

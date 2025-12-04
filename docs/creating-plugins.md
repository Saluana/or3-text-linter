# Creating Custom Linter Plugins

This guide walks you through creating custom lint plugins for the Tiptap Linter. We'll use the built-in `BadWords` plugin as a reference implementation.

## Table of Contents

-   [Understanding the Plugin Architecture](#understanding-the-plugin-architecture)
-   [The LinterPlugin Base Class](#the-linterplugin-base-class)
-   [Tutorial: Building a BadWords Plugin](#tutorial-building-a-badwords-plugin)
-   [Adding Fix Functions](#adding-fix-functions)
-   [Working with Different Node Types](#working-with-different-node-types)
-   [Best Practices](#best-practices)

## Understanding the Plugin Architecture

Every lint plugin extends the `LinterPlugin` base class and implements a `scan()` method that:

1. Traverses the ProseMirror document
2. Detects issues based on your rules
3. Records issues with positions, messages, and optional fixes

```
┌─────────────────────────────────────────────────────────┐
│                    Linter Extension                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  BadWords   │  │ Punctuation │  │ HeadingLevel│     │
│  │   Plugin    │  │   Plugin    │  │   Plugin    │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                              │
│                    ┌──────────┐                         │
│                    │  Issues  │                         │
│                    └────┬─────┘                         │
│                         ▼                               │
│                  ┌────────────┐                         │
│                  │ Decorations│                         │
│                  └────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## The LinterPlugin Base Class

The `LinterPlugin` class provides:

```typescript
class LinterPlugin {
    protected doc: ProsemirrorNode; // The document to scan

    constructor(doc: ProsemirrorNode);

    // Record an issue
    protected record(
        message: string, // Human-readable description
        from: number, // Start position
        to: number, // End position
        severity?: Severity, // 'info' | 'warning' | 'error' (default: 'warning')
        fix?: FixFn // Optional fix function
    ): void;

    // Override this method to implement your scanning logic
    scan(): this | Promise<this>;

    // Get all recorded issues
    getResults(): Issue[];
}
```

## Tutorial: Building a BadWords Plugin

Let's build a plugin that detects discouraged words step by step.

### Step 1: Create the Plugin Class

```typescript
import { LinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

export class BadWords extends LinterPlugin {
    constructor(doc: ProsemirrorNode) {
        super(doc);
    }

    scan(): this {
        // We'll implement this next
        return this;
    }
}
```

### Step 2: Define the Pattern to Match

We want to detect words like "obviously", "clearly", "evidently", and "simply":

```typescript
export class BadWords extends LinterPlugin {
    // Use a regex with the global flag for finding all matches
    private regex: RegExp;

    constructor(doc: ProsemirrorNode) {
        super(doc);
        // \b ensures we match whole words only
        // gi flags: global (all matches) and case-insensitive
        this.regex = /\b(obviously|clearly|evidently|simply)\b/gi;
    }

    scan(): this {
        return this;
    }
}
```

### Step 3: Traverse the Document

Use `doc.descendants()` to visit every node in the document:

```typescript
scan(): this {
  this.doc.descendants((node, pos) => {
    // Check if this is a text node
    if (node.isText && node.text) {
      this.scanTextNode(node.text, pos);
    }
  });
  return this;
}

private scanTextNode(text: string, basePos: number): void {
  // We'll implement this next
}
```

### Step 4: Find All Matches

**Important:** When using regex with the global flag, you must:

1. Reset `lastIndex` before each text node
2. Use a `while` loop to find ALL matches

```typescript
private scanTextNode(text: string, basePos: number): void {
  // CRITICAL: Reset lastIndex before scanning each text node
  this.regex.lastIndex = 0;

  let match: RegExpExecArray | null;

  // Loop through ALL matches in this text node
  while ((match = this.regex.exec(text)) !== null) {
    const word = match[1];  // The captured word
    const from = basePos + match.index;
    const to = from + match[0].length;

    // Record the issue
    this.record(
      `Avoid using "${word}"`,
      from,
      to,
      'warning'
    );
  }
}
```

### Complete BadWords Plugin

Here's the complete implementation:

```typescript
import { LinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

/**
 * BadWords plugin detects discouraged words in the document.
 * Default bad words: obviously, clearly, evidently, simply
 */
export class BadWords extends LinterPlugin {
    private regex: RegExp;

    constructor(doc: ProsemirrorNode) {
        super(doc);
        this.regex = /\b(obviously|clearly|evidently|simply)\b/gi;
    }

    scan(): this {
        this.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                this.scanTextNode(node.text, pos);
            }
        });
        return this;
    }

    private scanTextNode(text: string, basePos: number): void {
        this.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = this.regex.exec(text)) !== null) {
            const word = match[1];
            const from = basePos + match.index;
            const to = from + match[0].length;

            this.record(`Avoid using "${word}"`, from, to, 'warning');
        }
    }
}
```

## Adding Fix Functions

Fix functions allow users to automatically correct issues. Here's how to add one:

### Example: Punctuation Plugin with Fix

```typescript
import { LinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { Issue } from 'tiptap-linter';

export class Punctuation extends LinterPlugin {
    private regex: RegExp;

    constructor(doc: ProsemirrorNode) {
        super(doc);
        // Matches space(s) before punctuation
        this.regex = /(\s+)([,\.!?:])/g;
    }

    scan(): this {
        this.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                this.scanTextNode(node.text, pos);
            }
        });
        return this;
    }

    private scanTextNode(text: string, basePos: number): void {
        this.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = this.regex.exec(text)) !== null) {
            const punctuation = match[2];
            const from = basePos + match.index;
            const to = from + match[0].length;

            // Create a fix function
            const fix = (view: EditorView, issue: Issue): void => {
                // Replace " ," with ", " (remove space before, add space after)
                const replacement = punctuation + ' ';
                const tr = view.state.tr.replaceWith(
                    issue.from,
                    issue.to,
                    view.state.schema.text(replacement)
                );
                view.dispatch(tr);
            };

            this.record(
                `Unexpected space before "${punctuation}"`,
                from,
                to,
                'warning',
                fix // Pass the fix function
            );
        }
    }
}
```

### Fix Function Signature

```typescript
type FixFn = (view: EditorView, issue: Issue) => void;
```

The fix function receives:

-   `view`: The ProseMirror EditorView for dispatching transactions
-   `issue`: The Issue object with `from`, `to`, `message`, and `severity`

## Working with Different Node Types

### Scanning Heading Nodes

```typescript
export class HeadingLevel extends LinterPlugin {
    scan(): this {
        let lastHeadingLevel: number | null = null;

        this.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
                const currentLevel = node.attrs.level as number;

                if (lastHeadingLevel !== null) {
                    const levelJump = currentLevel - lastHeadingLevel;

                    if (levelJump > 1) {
                        const expectedLevel = lastHeadingLevel + 1;
                        const nodePos = pos;

                        // Fix function using setNodeMarkup
                        const fix = (view: EditorView, _issue: Issue): void => {
                            const tr = view.state.tr.setNodeMarkup(
                                nodePos,
                                undefined,
                                {
                                    level: expectedLevel,
                                }
                            );
                            view.dispatch(tr);
                        };

                        this.record(
                            `Heading jumps from H${lastHeadingLevel} to H${currentLevel}`,
                            pos,
                            pos + node.nodeSize,
                            'warning',
                            fix
                        );
                    }
                }

                lastHeadingLevel = currentLevel;
            }
        });

        return this;
    }
}
```

### Scanning List Items

```typescript
export class ListItemLength extends LinterPlugin {
    private maxLength = 100;

    scan(): this {
        this.doc.descendants((node, pos) => {
            if (node.type.name === 'listItem') {
                const text = node.textContent;
                if (text.length > this.maxLength) {
                    this.record(
                        `List item exceeds ${this.maxLength} characters`,
                        pos,
                        pos + node.nodeSize,
                        'info'
                    );
                }
            }
        });
        return this;
    }
}
```

### Scanning Links

```typescript
export class BrokenLinks extends LinterPlugin {
    scan(): this {
        this.doc.descendants((node, pos) => {
            // Check for link marks
            if (node.isText) {
                node.marks.forEach((mark) => {
                    if (mark.type.name === 'link') {
                        const href = mark.attrs.href;
                        if (!href || href === '#') {
                            this.record(
                                'Link has no valid URL',
                                pos,
                                pos + node.nodeSize,
                                'error'
                            );
                        }
                    }
                });
            }
        });
        return this;
    }
}
```

## Best Practices

### 1. Always Reset Regex lastIndex

When using global regexes, always reset `lastIndex` before scanning each text node:

```typescript
// ✅ Correct
this.regex.lastIndex = 0;
while ((match = this.regex.exec(text)) !== null) { ... }

// ❌ Wrong - will miss matches in subsequent text nodes
while ((match = this.regex.exec(text)) !== null) { ... }
```

### 2. Use Appropriate Severity Levels

-   **info**: Suggestions and style preferences
-   **warning**: Potential issues that should be reviewed
-   **error**: Critical problems that must be fixed

```typescript
// Style suggestion
this.record('Consider using active voice', from, to, 'info');

// Potential issue
this.record('Avoid using "obviously"', from, to, 'warning');

// Critical error
this.record('Broken link detected', from, to, 'error');
```

### 3. Provide Clear Messages

```typescript
// ✅ Good - specific and actionable
this.record(`Avoid using "${word}" - it weakens your argument`, from, to);

// ❌ Bad - vague
this.record('Bad word found', from, to);
```

### 4. Include Fix Functions When Possible

Users appreciate automatic fixes:

```typescript
// ✅ Good - provides a fix
this.record(message, from, to, 'warning', (view, issue) => {
    view.dispatch(view.state.tr.delete(issue.from, issue.to));
});

// Still okay - not all issues can be auto-fixed
this.record(message, from, to, 'warning');
```

### 5. Handle Edge Cases

```typescript
scan(): this {
  this.doc.descendants((node, pos) => {
    // Check for text content before processing
    if (node.isText && node.text && node.text.length > 0) {
      this.scanTextNode(node.text, pos);
    }
  });
  return this;
}
```

## Using Your Custom Plugin

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Linter } from 'tiptap-linter';
import { MyCustomPlugin } from './MyCustomPlugin';

const editor = new Editor({
    extensions: [
        StarterKit,
        Linter.configure({
            plugins: [MyCustomPlugin],
        }),
    ],
});
```

## Next Steps

-   [AI Linting Guide](./ai-linting.md) - Create AI-powered lint rules
-   [Popover Customization](./popover-customization.md) - Customize the issue UI
-   [API Reference](./api-reference.md) - Complete API documentation

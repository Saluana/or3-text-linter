# Popover Customization Guide

This guide covers how to customize the popover UI that appears when users click on lint icons.

## Table of Contents

-   [Overview](#overview)
-   [Default Popover Configuration](#default-popover-configuration)
-   [Styling the Default Popover](#styling-the-default-popover)
-   [Creating a Custom Renderer](#creating-a-custom-renderer)
-   [Popover Actions API](#popover-actions-api)
-   [Positioning Options](#positioning-options)
-   [Advanced Examples](#advanced-examples)

## Overview

When a user clicks a lint icon, a popover appears showing:

-   Issue severity badge
-   Issue message
-   Action buttons (Fix, Dismiss)

You can customize:

-   **Placement** - Where the popover appears relative to the icon
-   **Styling** - Colors, borders, shadows, etc.
-   **Content** - Completely custom UI with your own renderer

## Default Popover Configuration

```typescript
import { Linter, BadWords } from 'tiptap-linter';

Linter.configure({
    plugins: [BadWords],
    popover: {
        // Placement relative to the lint icon
        placement: 'bottom', // 'top' | 'bottom' | 'left' | 'right'

        // Show/hide elements
        showSeverity: true,
        showFixButton: true,

        // Custom styling
        style: {
            background: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            offset: 8, // Distance from icon in pixels
        },
    },
});
```

## Styling the Default Popover

### CSS Classes

The default popover uses these CSS classes:

```css
/* Main container */
.lint-popover-container {
    position: fixed;
    z-index: 9999;
}

/* Popover content */
.lint-popover {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
}

/* Individual issue */
.lint-popover__issue {
    margin-bottom: 12px;
}

.lint-popover__issue:last-child {
    margin-bottom: 0;
}

/* Severity badge */
.lint-popover__severity {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    margin-bottom: 4px;
}

/* Severity variants */
.lint-popover__issue--info .lint-popover__severity {
    background: #e3f2fd;
    color: #1976d2;
}

.lint-popover__issue--warning .lint-popover__severity {
    background: #fff3e0;
    color: #f57c00;
}

.lint-popover__issue--error .lint-popover__severity {
    background: #ffebee;
    color: #d32f2f;
}

/* Message */
.lint-popover__message {
    margin: 8px 0;
    font-size: 14px;
    line-height: 1.4;
    color: #333;
}

/* Actions container */
.lint-popover__actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

/* Buttons */
.lint-popover__btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}

.lint-popover__btn--fix {
    background: #4caf50;
    color: white;
    border: none;
}

.lint-popover__btn--fix:hover {
    background: #43a047;
}

.lint-popover__btn--dismiss {
    background: transparent;
    border: 1px solid #ccc;
    color: #666;
}

.lint-popover__btn--dismiss:hover {
    background: #f5f5f5;
}
```

### Dark Mode

```css
@media (prefers-color-scheme: dark) {
    .lint-popover {
        background: #1e1e1e;
        border-color: #333;
        color: #e0e0e0;
    }

    .lint-popover__message {
        color: #e0e0e0;
    }

    .lint-popover__btn--dismiss {
        border-color: #555;
        color: #aaa;
    }

    .lint-popover__btn--dismiss:hover {
        background: #333;
    }
}
```

## Creating a Custom Renderer

For complete control, provide a custom renderer function:

```typescript
import type { PopoverContext } from 'tiptap-linter';

function MyCustomPopover(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'my-custom-popover';

    for (const issue of context.issues) {
        const issueEl = document.createElement('div');
        issueEl.className = `issue issue--${issue.severity}`;

        // Severity icon
        const icon = document.createElement('span');
        icon.className = 'issue-icon';
        icon.innerHTML = getSeverityIcon(issue.severity);
        issueEl.appendChild(icon);

        // Message
        const message = document.createElement('p');
        message.className = 'issue-message';
        message.textContent = issue.message;
        issueEl.appendChild(message);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'issue-actions';

        if (issue.fix) {
            const fixBtn = document.createElement('button');
            fixBtn.textContent = '✓ Fix';
            fixBtn.onclick = () => context.actions.applyFix();
            actions.appendChild(fixBtn);
        }

        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = '✕';
        dismissBtn.onclick = () => context.actions.dismiss();
        actions.appendChild(dismissBtn);

        issueEl.appendChild(actions);
        container.appendChild(issueEl);
    }

    return container;
}

function getSeverityIcon(severity: string): string {
    switch (severity) {
        case 'info':
            return 'ℹ️';
        case 'warning':
            return '⚠️';
        case 'error':
            return '❌';
        default:
            return '•';
    }
}

// Use the custom renderer
Linter.configure({
    plugins: [BadWords],
    popover: {
        renderer: MyCustomPopover,
    },
});
```

### PopoverContext Interface

```typescript
interface PopoverContext {
    // The issue(s) at this position
    issues: Issue[];

    // Available actions
    actions: PopoverActions;

    // The EditorView for advanced use cases
    view: EditorView;
}

interface Issue {
    message: string;
    from: number;
    to: number;
    severity: 'info' | 'warning' | 'error';
    fix?: FixFn;
}
```

## Popover Actions API

The `actions` object provides these methods:

### applyFix()

Applies the fix function from the first issue that has one:

```typescript
const fixBtn = document.createElement('button');
fixBtn.textContent = 'Fix';
fixBtn.onclick = () => context.actions.applyFix();
```

### deleteText()

Deletes the text in the issue range:

```typescript
const deleteBtn = document.createElement('button');
deleteBtn.textContent = 'Delete';
deleteBtn.onclick = () => context.actions.deleteText();
```

### replaceText(newText)

Replaces the issue range with custom text:

```typescript
const input = document.createElement('input');
const replaceBtn = document.createElement('button');
replaceBtn.textContent = 'Replace';
replaceBtn.onclick = () => {
    context.actions.replaceText(input.value);
};
```

### dismiss()

Closes the popover without making changes:

```typescript
const dismissBtn = document.createElement('button');
dismissBtn.textContent = 'Dismiss';
dismissBtn.onclick = () => context.actions.dismiss();
```

## Positioning Options

### Placement

```typescript
popover: {
  placement: 'bottom',  // Default
}
```

| Value      | Description              |
| ---------- | ------------------------ |
| `'top'`    | Above the icon           |
| `'bottom'` | Below the icon           |
| `'left'`   | To the left of the icon  |
| `'right'`  | To the right of the icon |

### Offset

Distance from the icon in pixels:

```typescript
popover: {
  style: {
    offset: 12,  // 12px from the icon
  },
}
```

### Viewport Boundaries

The popover automatically adjusts to stay within the viewport.

## Advanced Examples

### React-Style Popover

```typescript
function ReactStylePopover(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'react-popover';

    // Header
    const header = document.createElement('div');
    header.className = 'popover-header';
    header.innerHTML = `
    <span class="popover-title">Issues (${context.issues.length})</span>
    <button class="popover-close">×</button>
  `;
    header.querySelector('.popover-close')!.addEventListener('click', () => {
        context.actions.dismiss();
    });
    container.appendChild(header);

    // Issue list
    const list = document.createElement('ul');
    list.className = 'popover-list';

    context.issues.forEach((issue, index) => {
        const item = document.createElement('li');
        item.innerHTML = `
      <div class="issue-header">
        <span class="severity-dot severity-dot--${issue.severity}"></span>
        <span class="issue-text">${issue.message}</span>
      </div>
    `;

        if (issue.fix) {
            const fixBtn = document.createElement('button');
            fixBtn.className = 'fix-link';
            fixBtn.textContent = 'Fix this';
            fixBtn.onclick = () => context.actions.applyFix();
            item.appendChild(fixBtn);
        }

        list.appendChild(item);
    });

    container.appendChild(list);
    return container;
}
```

### Tooltip-Style Popover

```typescript
function TooltipPopover(context: PopoverContext): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'lint-tooltip';

    const issue = context.issues[0];
    tooltip.innerHTML = `
    <div class="tooltip-content">
      <strong>${issue.severity.toUpperCase()}</strong>
      <p>${issue.message}</p>
    </div>
    <div class="tooltip-arrow"></div>
  `;

    // Auto-dismiss after 3 seconds
    setTimeout(() => context.actions.dismiss(), 3000);

    return tooltip;
}
```

### Popover with Custom Replace Input

```typescript
function ReplacePopover(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'replace-popover';

    const issue = context.issues[0];

    container.innerHTML = `
    <p class="issue-message">${issue.message}</p>
    <div class="replace-form">
      <input type="text" placeholder="Replacement text" class="replace-input">
      <div class="replace-actions">
        <button class="btn-replace">Replace</button>
        <button class="btn-delete">Delete</button>
        <button class="btn-dismiss">Skip</button>
      </div>
    </div>
  `;

    const input = container.querySelector('.replace-input') as HTMLInputElement;

    container.querySelector('.btn-replace')!.addEventListener('click', () => {
        if (input.value) {
            context.actions.replaceText(input.value);
        }
    });

    container.querySelector('.btn-delete')!.addEventListener('click', () => {
        context.actions.deleteText();
    });

    container.querySelector('.btn-dismiss')!.addEventListener('click', () => {
        context.actions.dismiss();
    });

    // Focus input on open
    setTimeout(() => input.focus(), 0);

    return container;
}
```

### Multiple Issues Display

```typescript
function MultiIssuePopover(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.className = 'multi-issue-popover';

    if (context.issues.length > 1) {
        const header = document.createElement('div');
        header.className = 'popover-header';
        header.textContent = `${context.issues.length} issues at this location`;
        container.appendChild(header);
    }

    context.issues.forEach((issue, index) => {
        const issueEl = document.createElement('div');
        issueEl.className = `issue-item issue-item--${issue.severity}`;

        const badge = document.createElement('span');
        badge.className = 'issue-badge';
        badge.textContent = `#${index + 1}`;
        issueEl.appendChild(badge);

        const content = document.createElement('div');
        content.className = 'issue-content';
        content.innerHTML = `
      <span class="severity">${issue.severity}</span>
      <p>${issue.message}</p>
    `;
        issueEl.appendChild(content);

        if (issue.fix) {
            const fixBtn = document.createElement('button');
            fixBtn.textContent = 'Fix';
            fixBtn.onclick = () => {
                issue.fix!(context.view, issue);
                context.view.focus();
                context.actions.dismiss();
            };
            issueEl.appendChild(fixBtn);
        }

        container.appendChild(issueEl);
    });

    // Dismiss all button
    const dismissAll = document.createElement('button');
    dismissAll.className = 'dismiss-all';
    dismissAll.textContent = 'Dismiss All';
    dismissAll.onclick = () => context.actions.dismiss();
    container.appendChild(dismissAll);

    return container;
}
```

## Programmatic Popover Control

Access the PopoverManager through storage:

```typescript
// Get the popover manager
const popoverManager = editor.storage.linter.popoverManager;

// Check if popover is visible
if (popoverManager?.isVisible()) {
    // Hide it
    popoverManager.hide();
}

// Show popover programmatically
const issues = editor.storage.linter.getIssues();
const iconElement = document.querySelector('.lint-icon');
if (issues.length > 0 && iconElement) {
    popoverManager?.show(issues, iconElement as HTMLElement);
}
```

## Next Steps

-   [Creating Custom Plugins](./creating-plugins.md) - Build your own lint rules
-   [AI Linting Guide](./ai-linting.md) - Integrate AI providers
-   [API Reference](./api-reference.md) - Complete API documentation

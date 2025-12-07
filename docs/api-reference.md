# API Reference

Complete API documentation for the Tiptap Linter extension.

## Table of Contents

-   [Linter Extension](#linter-extension)
-   [LinterPlugin](#linterplugin)
-   [AILinterPlugin](#ailinterplugin)
-   [createNaturalLanguageRule](#createnaturallanguagerule)
-   [PopoverManager](#popovermanager)
-   [Built-in Plugins](#built-in-plugins)
-   [Types](#types)
-   [Utility Functions](#utility-functions)

---

## Linter Extension

The main Tiptap extension that manages lint plugins and decorations.

### Import

```typescript
import { Linter } from 'tiptap-linter';
```

### Configuration

```typescript
Linter.configure(options: LinterOptions)
```

### LinterOptions

| Property           | Type                                                                 | Default     | Description                                        |
| ------------------ | -------------------------------------------------------------------- | ----------- | -------------------------------------------------- |
| `plugins`          | `Array<LinterPluginClass \| AsyncLinterPluginClass \| PluginConfig>` | `[]`        | Array of plugin classes or plugin configurations   |
| `popover`          | `PopoverOptions`                                                     | `undefined` | Popover configuration (optional)                   |
| `autoLint`         | `boolean`                                                            | `true`      | Whether to run plugins automatically on changes    |
| `customSeverities` | `CustomSeverity[]`                                                   | `undefined` | Custom severity definitions with colors (optional) |

### LinterStorage

Access via `editor.storage.linter`:

| Property               | Type                                                                                                  | Description                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `issues`               | `Issue[]`                                                                                             | Current array of detected issues             |
| `getIssues()`          | `() => Issue[]`                                                                                       | Returns the current issues array             |
| `popoverManager`       | `PopoverManager \| null`                                                                              | PopoverManager instance (if popover enabled) |
| `runRule()`            | `(plugin: LinterPluginClass \| AsyncLinterPluginClass, options?: RunRuleOptions) => Promise<Issue[]>` | Run a specific plugin on-demand              |
| `ignoredIssues`        | `IgnoredIssue[]`                                                                                      | List of issues that have been ignored        |
| `clearIgnoredIssues()` | `() => void`                                                                                          | Clear all ignored issues                     |

### Example

```typescript
import { Editor } from '@tiptap/core';
import { Linter, BadWords, Punctuation } from 'tiptap-linter';

const editor = new Editor({
    extensions: [
        Linter.configure({
            plugins: [BadWords, Punctuation],
            popover: {
                placement: 'bottom',
            },
        }),
    ],
});

// Access issues
const issues = editor.storage.linter.getIssues();
```

### On-Demand Linting

The Linter supports running specific plugins on-demand rather than automatically on every document change.

#### Disabling Automatic Linting

Set `autoLint: false` to disable automatic linting. You can then run rules manually using `runRule()`:

```typescript
const editor = new Editor({
    extensions: [
        Linter.configure({
            plugins: [BadWords, Punctuation],
            autoLint: false, // Disable automatic linting
        }),
    ],
});

// Run a specific rule on-demand
const issues = await editor.storage.linter.runRule(BadWords);
console.log('Found issues:', issues);
```

#### Per-Plugin Mode Configuration

Configure individual plugins to run only on-demand while others run automatically:

```typescript
import { Linter, BadWords, Punctuation } from 'tiptap-linter';
import type { PluginConfig } from 'tiptap-linter';

const editor = new Editor({
    extensions: [
        Linter.configure({
            plugins: [
                BadWords, // Runs automatically (default mode: 'auto')
                { plugin: Punctuation, mode: 'auto' }, // Explicit auto mode
                { plugin: AIGrammarChecker, mode: 'onDemand' }, // Only runs when called via runRule()
            ],
        }),
    ],
});

// Run the on-demand plugin manually
const grammarIssues = await editor.storage.linter.runRule(AIGrammarChecker);
```

#### runRule Options

The `runRule()` method accepts an optional options object:

```typescript
interface RunRuleOptions {
    /** Whether to apply results as decorations (default: false) */
    applyResults?: boolean;
}
```

Example with `applyResults`:

```typescript
// Run rule and apply decorations to the editor
await editor.storage.linter.runRule(BadWords, { applyResults: true });

// Run rule without modifying decorations (just get the issues)
const issues = await editor.storage.linter.runRule(BadWords, {
    applyResults: false,
});
```

### Custom Severities

Define custom severity levels beyond the built-in `info`, `warning`, and `error`:

```typescript
const editor = new Editor({
    extensions: [
        Linter.configure({
            plugins: [BadWords],
            customSeverities: [
                { name: 'suggestion', color: '#6366f1' },
                { name: 'critical', color: '#dc2626' },
                { name: 'style', color: '#8b5cf6' },
            ],
        }),
    ],
});
```

Custom severities automatically generate CSS classes:

-   `.problem--{name}` for inline highlights
-   `.lint-icon--{name}` for icons

Use custom severities in your plugins:

```typescript
class MyPlugin extends LinterPlugin {
    scan(): this {
        // Use a custom severity
        this.record('Consider rephrasing', from, to, 'suggestion');
        return this;
    }
}
```

### Ignoring Issues

Users can ignore specific issues via the popover's ignore button. Ignored issues are stored and won't be displayed again at the same position with the same message.

```typescript
// Access ignored issues
const ignored = editor.storage.linter.ignoredIssues;

// Clear all ignored issues
editor.storage.linter.clearIgnoredIssues();
```

The ignore action is also available in custom popover renderers via `actions.ignore()`:

```typescript
Linter.configure({
    plugins: [BadWords],
    popover: {
        renderer: (context) => {
            const el = document.createElement('div');
            const ignoreBtn = document.createElement('button');
            ignoreBtn.textContent = 'Ignore';
            ignoreBtn.onclick = () => context.actions.ignore();
            el.appendChild(ignoreBtn);
            return el;
        },
    },
});
```

---

## LinterPlugin

Base class for creating synchronous lint plugins.

### Import

```typescript
import { LinterPlugin } from 'tiptap-linter';
```

### Constructor

```typescript
constructor(doc: ProsemirrorNode)
```

| Parameter | Type              | Description                      |
| --------- | ----------------- | -------------------------------- |
| `doc`     | `ProsemirrorNode` | The ProseMirror document to scan |

### Properties

| Property | Type              | Access      | Description                |
| -------- | ----------------- | ----------- | -------------------------- |
| `doc`    | `ProsemirrorNode` | `protected` | The document being scanned |

### Methods

#### record()

Records a lint issue.

```typescript
protected record(
  message: string,
  from: number,
  to: number,
  severity?: Severity,
  fix?: FixFn
): void
```

| Parameter  | Type       | Default     | Description                      |
| ---------- | ---------- | ----------- | -------------------------------- |
| `message`  | `string`   | -           | Human-readable issue description |
| `from`     | `number`   | -           | Start position in document       |
| `to`       | `number`   | -           | End position in document         |
| `severity` | `Severity` | `'warning'` | Issue severity level             |
| `fix`      | `FixFn`    | `undefined` | Optional fix function            |

#### scan()

Override to implement scanning logic. Must return `this` for chaining.

```typescript
scan(): this | Promise<this>
```

#### getResults()

Returns all recorded issues.

```typescript
getResults(): Issue[]
```

### Example

```typescript
import { LinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

class MyPlugin extends LinterPlugin {
    constructor(doc: ProsemirrorNode) {
        super(doc);
    }

    scan(): this {
        this.doc.descendants((node, pos) => {
            if (node.isText && node.text?.includes('TODO')) {
                this.record(
                    'TODO comment found',
                    pos,
                    pos + node.text.length,
                    'info'
                );
            }
        });
        return this;
    }
}
```

---

## AILinterPlugin

Base class for creating asynchronous AI-powered lint plugins.

### Import

```typescript
import { AILinterPlugin } from 'tiptap-linter';
```

### Constructor

```typescript
constructor(doc: ProsemirrorNode, config: AILinterPluginConfig)
```

| Parameter | Type                   | Description                      |
| --------- | ---------------------- | -------------------------------- |
| `doc`     | `ProsemirrorNode`      | The ProseMirror document to scan |
| `config`  | `AILinterPluginConfig` | AI plugin configuration          |

### Properties

| Property | Type                   | Access      | Description                |
| -------- | ---------------------- | ----------- | -------------------------- |
| `doc`    | `ProsemirrorNode`      | `protected` | The document being scanned |
| `config` | `AILinterPluginConfig` | `protected` | Plugin configuration       |

### Methods

#### extractTextWithPositions()

Extracts plain text from the document with position mapping.

```typescript
protected extractTextWithPositions(): TextExtractionResult
```

Returns:

```typescript
interface TextExtractionResult {
    fullText: string; // Complete document text
    segments: TextSegment[]; // Position-mapped segments
}

interface TextSegment {
    text: string; // Segment text content
    from: number; // ProseMirror start position
    to: number; // ProseMirror end position
    textOffset: number; // Offset in fullText
}
```

#### findTextPosition()

Finds ProseMirror positions for a text match.

```typescript
protected findTextPosition(
  textMatch: string,
  segments: TextSegment[],
  fullText: string
): { from: number; to: number } | null
```

#### createTextFix()

Creates a fix function that replaces text.

```typescript
protected createTextFix(replacement: string): FixFn
```

#### parseAIResponse()

Parses an AI response and records issues.

```typescript
protected parseAIResponse(
  response: unknown,
  segments: TextSegment[],
  fullText: string
): void
```

#### scan()

Abstract method - must be implemented by subclasses.

```typescript
abstract scan(): Promise<this>
```

### Example

```typescript
import { AILinterPlugin } from 'tiptap-linter';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { AILinterPluginConfig } from 'tiptap-linter';

class GrammarChecker extends AILinterPlugin {
    constructor(doc: ProsemirrorNode, config: AILinterPluginConfig) {
        super(doc, config);
    }

    async scan(): Promise<this> {
        const { fullText, segments } = this.extractTextWithPositions();

        if (!fullText.trim()) return this;

        try {
            const response = await this.config.provider(
                'Check for grammar errors. Return JSON with issues array.',
                fullText
            );
            this.parseAIResponse(response, segments, fullText);
        } catch (error) {
            console.error('Grammar check failed:', error);
        }

        return this;
    }
}
```

---

## createNaturalLanguageRule

Factory function to create AI lint plugins from plain English descriptions.

### Import

```typescript
import { createNaturalLanguageRule } from 'tiptap-linter';
```

### Signature

```typescript
function createNaturalLanguageRule(
    config: NaturalLanguageRuleConfig
): AsyncLinterPluginClass;
```

### NaturalLanguageRuleConfig

| Property   | Type           | Required | Default     | Description                    |
| ---------- | -------------- | -------- | ----------- | ------------------------------ |
| `rule`     | `string`       | Yes      | -           | Plain English rule description |
| `provider` | `AIProviderFn` | Yes      | -           | AI provider function           |
| `severity` | `Severity`     | No       | `'warning'` | Default severity for issues    |

### Example

```typescript
import { createNaturalLanguageRule } from 'tiptap-linter';

const NoPassiveVoice = createNaturalLanguageRule({
    rule: 'Avoid passive voice. Use active voice instead.',
    provider: async (prompt, content) => {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content },
            ],
        });
        return JSON.parse(response.choices[0].message.content!);
    },
    severity: 'warning',
});
```

---

## PopoverManager

Manages the display and interaction of lint issue popovers.

### Import

```typescript
import { PopoverManager } from 'tiptap-linter';
```

### Constructor

```typescript
constructor(view: EditorView, options?: PopoverOptions)
```

### Methods

#### show()

Displays a popover with issues.

```typescript
show(issues: Issue[], anchorEl: HTMLElement): void
```

| Parameter  | Type          | Description                     |
| ---------- | ------------- | ------------------------------- |
| `issues`   | `Issue[]`     | Issues to display               |
| `anchorEl` | `HTMLElement` | Element to position relative to |

#### hide()

Hides and removes the popover.

```typescript
hide(): void
```

#### isVisible()

Checks if a popover is currently visible.

```typescript
isVisible(): boolean
```

### Example

```typescript
const popoverManager = editor.storage.linter.popoverManager;

// Show popover
const issues = editor.storage.linter.getIssues();
const icon = document.querySelector('.lint-icon');
popoverManager?.show(issues, icon as HTMLElement);

// Hide popover
popoverManager?.hide();

// Check visibility
if (popoverManager?.isVisible()) {
    console.log('Popover is open');
}
```

---

## Built-in Plugins

### BadWords

Detects discouraged words.

```typescript
import { BadWords } from 'tiptap-linter';
```

**Detected words:** obviously, clearly, evidently, simply

**Severity:** warning

### Punctuation

Detects and fixes suspicious punctuation spacing.

```typescript
import { Punctuation } from 'tiptap-linter';
```

**Detects:** Spaces before punctuation marks (`,`, `.`, `!`, `?`, `:`)

**Severity:** warning

**Fix:** Removes space before punctuation, adds space after

### HeadingLevel

Detects heading level jumps.

```typescript
import { HeadingLevel } from 'tiptap-linter';
```

**Detects:** Heading level jumps > 1 (e.g., H1 → H3)

**Severity:** warning

**Fix:** Adjusts heading to correct level

---

## Types

### Severity

```typescript
type Severity = 'info' | 'warning' | 'error' | (string & {});
```

Custom severity names can be used when `customSeverities` is configured.

### Issue

```typescript
interface Issue {
    message: string; // Human-readable description
    from: number; // Start position
    to: number; // End position
    severity: Severity; // Severity level
    fix?: FixFn; // Optional fix function
}
```

### FixFn

```typescript
type FixFn = (view: EditorView, issue: Issue) => void;
```

### AIProviderFn

```typescript
type AIProviderFn = (prompt: string, content: string) => Promise<AIResponse>;
```

### AIResponse

```typescript
interface AIResponse {
    issues: Array<{
        message: string;
        textMatch: string;
        suggestion?: string;
    }>;
}
```

### AILinterPluginConfig

```typescript
interface AILinterPluginConfig {
    provider: AIProviderFn;
    systemPrompt?: string;
    severity?: Severity;
    contentScope?: 'full' | 'selection' | 'changed';
}
```

### PopoverOptions

```typescript
interface PopoverOptions {
    renderer?: PopoverRenderer;
    placement?: PopoverPlacement;
    style?: PopoverStyle;
    showSeverity?: boolean;
    showFixButton?: boolean;
}
```

### PopoverPlacement

```typescript
type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right';
```

### PopoverStyle

```typescript
interface PopoverStyle {
    border?: string;
    background?: string;
    padding?: string;
    borderRadius?: string;
    boxShadow?: string;
    offset?: number;
}
```

### PopoverActions

```typescript
interface PopoverActions {
    applyFix: () => void;
    deleteText: () => void;
    replaceText: (newText: string) => void;
    dismiss: () => void;
    ignore: () => void;
}
```

### PopoverContext

```typescript
interface PopoverContext {
    issues: Issue[];
    actions: PopoverActions;
    view: EditorView;
}
```

### PopoverRenderer

```typescript
type PopoverRenderer = (context: PopoverContext) => HTMLElement;
```

### LinterPluginClass

```typescript
type LinterPluginClass = new (doc: ProsemirrorNode) => LinterPluginInterface;
```

### AsyncLinterPluginClass

```typescript
type AsyncLinterPluginClass = new (
    doc: ProsemirrorNode
) => LinterPluginInterface;
```

### PluginConfig

```typescript
interface PluginConfig {
    /** The plugin class to use */
    plugin: LinterPluginClass | AsyncLinterPluginClass;
    /** Execution mode: 'auto' runs on document changes, 'onDemand' requires manual trigger */
    mode?: 'auto' | 'onDemand';
}
```

### CustomSeverity

```typescript
interface CustomSeverity {
    /** Unique name for the severity level */
    name: string;
    /** CSS color value for highlighting and icons */
    color: string;
}
```

### IgnoredIssue

```typescript
interface IgnoredIssue {
    /** Start position in document where issue was ignored */
    from: number;
    /** End position in document where issue was ignored */
    to: number;
    /** Issue message to match */
    message: string;
}
```

### RunRuleOptions

```typescript
interface RunRuleOptions {
    /** Whether to apply results as decorations (default: false) */
    applyResults?: boolean;
}
```

---

## Utility Functions

### renderIcon

Creates a lint icon element.

```typescript
import { renderIcon } from 'tiptap-linter';

function renderIcon(issue: Issue): IconDivElement;
```

### createDecorationSet

Creates a DecorationSet from issues.

```typescript
import { createDecorationSet } from 'tiptap-linter';

function createDecorationSet(
    doc: ProsemirrorNode,
    issues: Issue[]
): DecorationSet;
```

### runAllLinterPlugins

Runs all plugins and returns decorations.

```typescript
import { runAllLinterPlugins } from 'tiptap-linter';

async function runAllLinterPlugins(
    doc: ProsemirrorNode,
    plugins: Array<LinterPluginClass | AsyncLinterPluginClass>
): Promise<{ decorations: DecorationSet; issues: Issue[] }>;
```

### createDefaultPopover

Creates the default popover UI.

```typescript
import { createDefaultPopover } from 'tiptap-linter';

function createDefaultPopover(context: PopoverContext): HTMLElement;
```

---

## CSS Classes

### Inline Decorations

| Class               | Description                                       |
| ------------------- | ------------------------------------------------- |
| `.problem`          | Base class for all inline highlights              |
| `.problem--info`    | Info severity highlight                           |
| `.problem--warning` | Warning severity highlight                        |
| `.problem--error`   | Error severity highlight                          |
| `.problem--{name}`  | Custom severity highlight (generated dynamically) |

### Widget Icons

| Class                 | Description                                  |
| --------------------- | -------------------------------------------- |
| `.lint-icon`          | Base class for lint icons                    |
| `.lint-icon--info`    | Info severity icon                           |
| `.lint-icon--warning` | Warning severity icon                        |
| `.lint-icon--error`   | Error severity icon                          |
| `.lint-icon--{name}`  | Custom severity icon (generated dynamically) |

### Popover

| Class                           | Description                    |
| ------------------------------- | ------------------------------ |
| `.lint-popover-container`       | Popover container (positioned) |
| `.lint-popover`                 | Popover content wrapper        |
| `.lint-popover__issue`          | Individual issue container     |
| `.lint-popover__issue--info`    | Info severity issue            |
| `.lint-popover__issue--warning` | Warning severity issue         |
| `.lint-popover__issue--error`   | Error severity issue           |
| `.lint-popover__severity`       | Severity badge                 |
| `.lint-popover__message`        | Issue message text             |
| `.lint-popover__actions`        | Action buttons container       |
| `.lint-popover__btn`            | Base button class              |
| `.lint-popover__btn--fix`       | Fix button                     |
| `.lint-popover__btn--dismiss`   | Dismiss button                 |
| `.lint-popover__btn--ignore`    | Ignore button                  |

# Vue Component Popovers

This guide provides a comprehensive overview of using Vue components for popover rendering in the tiptap-linter extension.

## Why Use Vue Components?

Vue components provide the best developer experience for building custom popover UIs:

-   **🎯 Type Safety**: Full TypeScript support with typed props and composables
-   **⚡ Reactivity**: Automatic reactive updates with Vue's reactivity system
-   **🎨 Scoped Styles**: CSS scoped to your component automatically
-   **🔧 Clean API**: Access popover actions via simple composables
-   **✅ Testability**: Easy to unit test Vue components
-   **♻️ Reusability**: Share components across your application
-   **🐛 DevTools**: Use Vue DevTools for debugging

## Quick Start

### 1. Create Your Vue Component

```vue
<script setup lang="ts">
import { usePopoverActions } from 'tiptap-linter';
import type { Issue } from 'tiptap-linter';

defineProps<{
    issues: Issue[];
}>();

const actions = usePopoverActions();
</script>

<template>
    <div class="my-popover">
        <div v-for="issue in issues" :key="issue.message">
            <p>{{ issue.message }}</p>
            <button v-if="issue.fix" @click="actions.applyFix()">Fix</button>
            <button @click="actions.dismiss()">Dismiss</button>
        </div>
    </div>
</template>

<style scoped>
.my-popover {
    padding: 12px;
}
</style>
```

### 2. Configure the Linter

```typescript
import { Linter } from 'tiptap-linter';
import MyPopover from './components/MyPopover.vue';

Linter.configure({
    plugins: [
        /* your linter plugins */
    ],
    popover: {
        vueComponent: {
            component: MyPopover,
        },
    },
});
```

That's it! Your Vue component will now be used for all popovers.

## Composables API

The library provides two composables for accessing popover functionality:

### `usePopoverActions()`

Returns the actions API to interact with the editor:

```typescript
interface PopoverActions {
    applyFix: () => void; // Apply the issue's fix function
    deleteText: () => void; // Delete the text in the issue range
    replaceText: (newText: string) => void; // Replace with new text
    dismiss: () => void; // Close the popover
}
```

Example usage:

```vue
<script setup lang="ts">
import { usePopoverActions } from 'tiptap-linter';

const actions = usePopoverActions();

function handleFix() {
    actions.applyFix();
    // Popover closes automatically after applying fix
}
</script>
```

### `usePopoverContext()`

Returns the full popover context including issues, actions, and editor view:

```typescript
interface PopoverContext {
    issues: Issue[]; // All issues at this location
    actions: PopoverActions; // The actions API
    view: EditorView; // ProseMirror EditorView instance
}
```

Example usage:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { usePopoverContext } from 'tiptap-linter';

const { issues, actions, view } = usePopoverContext();

// Access editor state
const selectedText = computed(() => {
    const { from, to } = view.state.selection;
    return view.state.doc.textBetween(from, to);
});

// Get current document text
const docText = view.state.doc.textContent;
</script>
```

## Props Passed to Components

Your component automatically receives these props:

```typescript
interface PopoverComponentProps {
    issues: Issue[]; // Array of issues at this location
    view: EditorView; // ProseMirror editor view
}
```

You can access them using `defineProps`:

```vue
<script setup lang="ts">
import type { Issue } from 'tiptap-linter';
import type { EditorView } from '@tiptap/pm/view';

interface Props {
    issues: Issue[];
    view: EditorView;
}

const props = defineProps<Props>();
</script>
```

## Passing Custom Props

You can pass additional props to your component:

```typescript
Linter.configure({
    popover: {
        vueComponent: {
            component: MyPopover,
            props: {
                theme: 'dark',
                showLineNumbers: true,
                maxHeight: 400,
            },
        },
    },
});
```

Access them in your component:

```vue
<script setup lang="ts">
import type { Issue } from 'tiptap-linter';

interface Props {
    issues: Issue[];
    theme?: 'light' | 'dark';
    showLineNumbers?: boolean;
    maxHeight?: number;
}

const props = withDefaults(defineProps<Props>(), {
    theme: 'light',
    showLineNumbers: false,
    maxHeight: 300,
});
</script>

<template>
    <div :class="`popover popover--${props.theme}`" :style="{ maxHeight: `${props.maxHeight}px` }">
        <!-- component content -->
    </div>
</template>
```

**Note:** The props `issues` and `view` are reserved and automatically provided by the popover manager. Any custom props with these names will be overwritten.

## Complete Examples

### Basic Popover

```vue
<script setup lang="ts">
import { usePopoverActions } from 'tiptap-linter';
import type { Issue } from 'tiptap-linter';

defineProps<{ issues: Issue[] }>();
const actions = usePopoverActions();
</script>

<template>
    <div class="popover">
        <div v-for="(issue, i) in issues" :key="i" :class="`issue-${issue.severity}`">
            <span class="badge">{{ issue.severity }}</span>
            <p>{{ issue.message }}</p>
            <button v-if="issue.fix" @click="actions.applyFix()">Fix</button>
            <button @click="actions.dismiss()">Dismiss</button>
        </div>
    </div>
</template>

<style scoped>
.popover {
    padding: 12px;
    min-width: 200px;
}
.badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
}
.issue-error .badge {
    background: #fee;
    color: #c00;
}
.issue-warning .badge {
    background: #ffc;
    color: #840;
}
</style>
```

### Advanced Popover with Input

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { usePopoverActions } from 'tiptap-linter';
import type { Issue } from 'tiptap-linter';

defineProps<{ issues: Issue[] }>();
const actions = usePopoverActions();
const replacement = ref('');
</script>

<template>
    <div class="advanced-popover">
        <div v-for="(issue, i) in issues" :key="i">
            <h4>{{ issue.severity.toUpperCase() }}</h4>
            <p>{{ issue.message }}</p>

            <input v-model="replacement" placeholder="Replace with..." @keyup.enter="actions.replaceText(replacement)" />

            <div class="buttons">
                <button v-if="issue.fix" @click="actions.applyFix()">Auto-fix</button>
                <button :disabled="!replacement" @click="actions.replaceText(replacement)">Replace</button>
                <button @click="actions.deleteText()">Delete</button>
                <button @click="actions.dismiss()">Close</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.advanced-popover {
    padding: 16px;
    min-width: 280px;
}
input {
    width: 100%;
    padding: 8px;
    margin: 8px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
}
.buttons {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
```

### Multi-Issue Popover

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { usePopoverActions } from 'tiptap-linter';
import type { Issue } from 'tiptap-linter';

defineProps<{ issues: Issue[] }>();
const actions = usePopoverActions();
const selectedIndex = ref(0);
</script>

<template>
    <div class="multi-issue-popover">
        <div class="header">
            <span class="count">{{ issues.length }} issue{{ issues.length > 1 ? 's' : '' }}</span>
            <button class="close" @click="actions.dismiss()">×</button>
        </div>

        <div v-if="issues.length > 1" class="tabs">
            <button v-for="(issue, i) in issues" :key="i" :class="{ active: i === selectedIndex }" @click="selectedIndex = i">
                {{ issue.severity }}
            </button>
        </div>

        <div class="content">
            <div v-for="(issue, i) in issues" v-show="i === selectedIndex" :key="i">
                <p class="message">{{ issue.message }}</p>
                <div class="actions">
                    <button v-if="issue.fix" class="fix" @click="actions.applyFix()">Fix</button>
                    <button class="dismiss" @click="actions.dismiss()">Dismiss</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.multi-issue-popover {
    min-width: 280px;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #eee;
}
.count {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    color: #666;
}
.close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
}
.tabs {
    display: flex;
    border-bottom: 1px solid #eee;
}
.tabs button {
    flex: 1;
    padding: 8px;
    border: none;
    background: none;
    cursor: pointer;
    text-transform: capitalize;
}
.tabs button.active {
    background: #f5f5f5;
    font-weight: 600;
}
.content {
    padding: 12px;
}
.message {
    margin: 0 0 12px;
    line-height: 1.5;
}
.actions {
    display: flex;
    gap: 8px;
}
button {
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
}
.fix {
    background: #3b82f6;
    color: white;
    border: none;
}
.dismiss {
    background: #f3f4f6;
    border: 1px solid #ddd;
}
</style>
```

## Styling Options

### Using Scoped Styles

Vue's scoped styles work perfectly with popovers:

```vue
<style scoped>
.my-popover {
    /* Styles only affect this component */
    background: white;
    border-radius: 8px;
}
</style>
```

### Using CSS Modules

You can also use CSS modules:

```vue
<template>
    <div :class="$style.popover">
        <!-- content -->
    </div>
</template>

<style module>
.popover {
    padding: 12px;
}
</style>
```

### Dynamic Styles

Use Vue's reactive styles:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Issue } from 'tiptap-linter';

const props = defineProps<{ issues: Issue[] }>();

const severity = computed(() => props.issues[0]?.severity);
const borderColor = computed(() => {
    switch (severity.value) {
        case 'error':
            return '#ef4444';
        case 'warning':
            return '#f59e0b';
        default:
            return '#3b82f6';
    }
});
</script>

<template>
    <div class="popover" :style="{ borderLeft: `4px solid ${borderColor}` }">
        <!-- content -->
    </div>
</template>
```

## Testing

Vue components for popovers are easy to test:

```typescript
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import MyPopover from './MyPopover.vue';

describe('MyPopover', () => {
    it('renders issues correctly', () => {
        const issues = [
            {
                message: 'Test issue',
                from: 1,
                to: 5,
                severity: 'warning',
            },
        ];

        const wrapper = mount(MyPopover, {
            props: { issues },
            global: {
                provide: {
                    popoverActions: {
                        applyFix: vi.fn(),
                        deleteText: vi.fn(),
                        replaceText: vi.fn(),
                        dismiss: vi.fn(),
                    },
                },
            },
        });

        expect(wrapper.text()).toContain('Test issue');
    });

    it('calls dismiss when button clicked', async () => {
        const dismissMock = vi.fn();
        const wrapper = mount(MyPopover, {
            props: {
                issues: [
                    {
                        message: 'Test',
                        from: 1,
                        to: 5,
                        severity: 'info',
                    },
                ],
            },
            global: {
                provide: {
                    popoverActions: {
                        applyFix: vi.fn(),
                        deleteText: vi.fn(),
                        replaceText: vi.fn(),
                        dismiss: dismissMock,
                    },
                },
            },
        });

        await wrapper.find('button').trigger('click');
        expect(dismissMock).toHaveBeenCalled();
    });
});
```

## Performance Considerations

-   **Automatic Cleanup**: Vue apps are automatically unmounted when popovers close
-   **Memory Efficient**: No memory leaks from orphaned Vue instances
-   **Reactive**: Only updates when props change
-   **Lazy Loading**: Components can be lazy-loaded with `defineAsyncComponent`

Example with lazy loading:

```typescript
import { defineAsyncComponent } from 'vue';

Linter.configure({
    popover: {
        vueComponent: {
            component: defineAsyncComponent(() => import('./components/MyPopover.vue')),
        },
    },
});
```

## Migration from Custom Renderers

If you're using a custom renderer function, migrating to Vue components is straightforward:

**Before (Custom Renderer):**

```typescript
function customRenderer(context: PopoverContext): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `<p>${context.issues[0].message}</p>`;

    const btn = document.createElement('button');
    btn.textContent = 'Dismiss';
    btn.onclick = () => context.actions.dismiss();
    container.appendChild(btn);

    return container;
}
```

**After (Vue Component):**

```vue
<script setup lang="ts">
import { usePopoverActions } from 'tiptap-linter';
import type { Issue } from 'tiptap-linter';

defineProps<{ issues: Issue[] }>();
const actions = usePopoverActions();
</script>

<template>
    <div>
        <p>{{ issues[0].message }}</p>
        <button @click="actions.dismiss()">Dismiss</button>
    </div>
</template>
```

## Best Practices

1. **Use Composables**: Always use `usePopoverActions()` or `usePopoverContext()` instead of accessing props.actions
2. **Type Your Props**: Define proper TypeScript interfaces for better type safety
3. **Handle Edge Cases**: Check if issues array is empty before accessing elements
4. **Keep It Simple**: Don't overcomplicate the popover UI - focus on quick actions
5. **Test Components**: Write unit tests for your popover components
6. **Use Scoped Styles**: Keep styles scoped to avoid CSS conflicts
7. **Accessibility**: Add proper ARIA labels and keyboard navigation

## Troubleshooting

### Error: "usePopoverActions must be called within a Vue component rendered in a popover"

This error occurs when you try to use the composable outside a popover context. Make sure:

-   You're using the composable inside `<script setup>` or `setup()`
-   The component is rendered as a popover via `vueComponent` config
-   You're not trying to use it in a standalone component

### Component Not Updating

If your component isn't updating reactively:

-   Ensure you're using `ref()` or `reactive()` for local state
-   Check that props are properly defined with `defineProps`
-   Verify the component is receiving updated props

### Styles Not Applied

If styles aren't working:

-   Make sure you're using `<style scoped>` in your SFC
-   Check for CSS specificity issues
-   Verify the component is properly mounted

## Related Documentation

-   [Popover Customization Guide](./popover-customization.md)
-   [API Reference](./api-reference.md)
-   [Creating Plugins](./creating-plugins.md)

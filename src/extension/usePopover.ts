import { inject } from 'vue';
import type { PopoverActions, PopoverContext } from '../types';

/**
 * Vue composable for accessing popover actions within a Vue component
 * rendered in a popover.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { usePopoverActions } from 'tiptap-linter';
 * 
 * const actions = usePopoverActions();
 * 
 * function handleFix() {
 *   actions.applyFix();
 * }
 * </script>
 * ```
 *
 * @returns PopoverActions object with methods to interact with the document
 * @throws Error if used outside a popover Vue component context
 */
export function usePopoverActions(): PopoverActions {
    const actions = inject<PopoverActions>('popoverActions');
    
    if (!actions) {
        throw new Error(
            'usePopoverActions must be called within a Vue component rendered in a popover'
        );
    }
    
    return actions;
}

/**
 * Vue composable for accessing the full popover context within a Vue component
 * rendered in a popover.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { usePopoverContext } from 'tiptap-linter';
 * 
 * const { issues, actions, view } = usePopoverContext();
 * </script>
 * ```
 *
 * @returns PopoverContext object with issues, actions, and editor view
 * @throws Error if used outside a popover Vue component context
 */
export function usePopoverContext(): PopoverContext {
    const context = inject<PopoverContext>('popoverContext');
    
    if (!context) {
        throw new Error(
            'usePopoverContext must be called within a Vue component rendered in a popover'
        );
    }
    
    return context;
}

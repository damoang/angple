<script lang="ts">
    import { Tooltip as TooltipPrimitive } from 'bits-ui';
    import { cn } from '$lib/utils.js';

    let {
        ref = $bindable(null),
        class: className,
        sideOffset = 6,
        children,
        ...restProps
    }: TooltipPrimitive.ContentProps = $props();
</script>

<TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
        bind:ref
        data-slot="tooltip-content"
        {sideOffset}
        class={cn(
            'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 w-fit max-w-xs rounded-md border px-3 py-2 text-xs leading-relaxed shadow-md',
            className
        )}
        {...restProps}
    >
        {@render children?.()}
    </TooltipPrimitive.Content>
</TooltipPrimitive.Portal>

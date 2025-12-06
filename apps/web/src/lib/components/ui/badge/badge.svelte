<script lang="ts" module>
    import { cn, type WithElementRef } from '$lib/utils.js';
    import type { HTMLAttributes } from 'svelte/elements';
    import { type VariantProps, tv } from 'tailwind-variants';

    export const badgeVariants = tv({
        base: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground border-transparent shadow hover:bg-primary/80',
                secondary:
                    'bg-subtle text-secondary-foreground border-transparent hover:bg-secondary/80',
                destructive:
                    'bg-destructive text-destructive-foreground border-transparent shadow hover:bg-destructive/80',
                outline: 'text-foreground'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    });

    export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

    export type BadgeProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
        variant?: BadgeVariant;
    };
</script>

<script lang="ts">
    let {
        ref = $bindable(null),
        class: className,
        variant = 'default',
        children,
        ...restProps
    }: BadgeProps = $props();
</script>

<div bind:this={ref} class={cn(badgeVariants({ variant }), className)} {...restProps}>
    {@render children?.()}
</div>

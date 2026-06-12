<script lang="ts">
    import { Tooltip as TooltipPrimitive } from 'bits-ui';

    let { ...restProps }: TooltipPrimitive.RootProps = $props();
</script>

<TooltipPrimitive.Root {...restProps} />

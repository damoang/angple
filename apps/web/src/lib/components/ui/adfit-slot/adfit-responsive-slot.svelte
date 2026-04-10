<script lang="ts">
    import { onMount } from 'svelte';
    import AdfitSlot from './adfit-slot.svelte';

    interface AdfitUnit {
        unitId: string;
        width: number;
        height: number;
    }

    interface Props {
        desktop: AdfitUnit;
        mobile: AdfitUnit;
        id: string;
        breakpoint?: number;
    }

    let { desktop, mobile, id, breakpoint = 728 }: Props = $props();
    let unit = $state<AdfitUnit | null>(null);

    onMount(() => {
        unit = window.innerWidth >= breakpoint ? desktop : mobile;
    });
</script>

{#if unit}
    <AdfitSlot {unit} {id} />
{/if}

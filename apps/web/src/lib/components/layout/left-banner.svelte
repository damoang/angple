<script lang="ts">
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
</script>

<!-- 왼쪽 윙 배너 (GAM) -->
{#if widgetLayoutStore.hasEnabledAds}
    <div class="flex w-[160px] flex-col items-center justify-center gap-2">
        <AdSlot position="wing-left" height="600px" />
    </div>
{/if}

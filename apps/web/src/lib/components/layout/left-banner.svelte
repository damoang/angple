<script lang="ts">
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
</script>

<!-- 왼쪽 윙 배너 (GAM) — 항상 마운트 (SPA 이동 시 리프레시 방지) -->
<div
    class="flex w-[160px] flex-col items-center justify-center gap-2"
    class:hidden={!widgetLayoutStore.hasEnabledAds}
>
    <AdSlot position="wing-left" height="600px" slotKey="wing-left" />
</div>

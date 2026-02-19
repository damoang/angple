<script lang="ts">
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import DamoangBanner from '$lib/components/ui/damoang-banner/damoang-banner.svelte';
</script>

<div class="flex flex-col gap-4 p-4">
    <!-- Slot: sidebar-right-top -->
    {#each getComponentsForSlot('sidebar-right-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- 축하메시지 이미지 배너 (헤더 없이) -->
    <DamoangBanner position="sidebar" height="auto" />

    <!-- 통합 위젯 렌더러 (사이드바) -->
    <WidgetRenderer zone="sidebar" />

    <!-- Slot: sidebar-right-bottom -->
    {#each getComponentsForSlot('sidebar-right-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}
</div>

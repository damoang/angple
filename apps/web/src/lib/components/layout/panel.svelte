<script lang="ts">
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import DamoangBanner from '$lib/components/ui/damoang-banner/damoang-banner.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
</script>

<div class="flex h-full flex-col gap-4 p-4">
    <!-- Slot: sidebar-right-top -->
    {#each getComponentsForSlot('sidebar-right-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- 공지사항 위젯만 먼저 렌더링 -->
    <WidgetRenderer zone="sidebar" onlyIds={['notice']} />

    <!-- 축하메시지 캐러셀 (공지사항 바로 아래) -->
    <DamoangBanner position="sidebar" height="auto" />

    <!-- 나머지 사이드바 위젯 (광고 등) -->
    <WidgetRenderer zone="sidebar" excludeIds={['notice']} />

    <!-- Slot: sidebar-right-bottom -->
    {#each getComponentsForSlot('sidebar-right-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- 스크롤 시 고정되는 GAM 광고 (양쪽 날개형) -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="sticky top-[64px] space-y-3">
            <AdSlot position="sidebar-sticky" height="600px" />
            <AdSlot position="sidebar-2" height="250px" />
        </div>
    {/if}
</div>

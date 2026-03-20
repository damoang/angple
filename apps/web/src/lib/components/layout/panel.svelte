<script lang="ts">
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
</script>

<div class="flex min-h-full flex-col gap-4 p-4">
    <!-- Slot: sidebar-right-top -->
    {#each getComponentsForSlot('sidebar-right-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- 공지사항 위젯 (가장 위) -->
    <WidgetRenderer zone="sidebar" onlyIds={['notice']} />

    <!-- 사이드바 배너 (슬롯 기반) -->
    <PluginSlot name="sidebar-banner" />

    <!-- 공지사항/나눔 아래의 핵심 보조 광고 자리 -->
    <div class:hidden={!widgetLayoutStore.hasEnabledAds}>
        <div class="sticky top-[64px]">
            <AdSlot
                position="sidebar-sticky-desktop"
                height="600px"
                slotKey="sidebar-sticky-desktop"
            />
        </div>
    </div>

    <!-- 나머지 사이드바 위젯 -->
    <WidgetRenderer zone="sidebar" excludeIds={['notice']} />

    <!-- Slot: sidebar-right-bottom -->
    {#each getComponentsForSlot('sidebar-right-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}
</div>

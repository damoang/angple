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

    <!-- 마음메시지 카드 위젯 (공지 아래, 사이드바 배너 위) -->
    <WidgetRenderer zone="sidebar" onlyIds={['celebration']} />

    <!-- 이용가이드 미니 카드 (마음메시지 아래) -->
    <a
        href="/content/guide"
        class="block rounded-xl border bg-teal-50 p-3.5 text-center no-underline transition-colors hover:border-teal-300 dark:bg-teal-950/30"
    >
        <div class="text-2xl">🙌</div>
        <div class="text-foreground mt-0.5 text-sm font-bold">다모앙 이용가이드</div>
        <div class="text-muted-foreground text-xs">처음이신가요? 3분이면 충분해요</div>
        <span
            class="mt-2 inline-block rounded-full bg-teal-500 px-3.5 py-1 text-xs font-bold text-white"
            >가이드 보기 →</span
        >
    </a>

    <!-- 사이드바 배너 (슬롯 기반) -->
    <PluginSlot name="sidebar-banner" />

    <!-- 나머지 사이드바 위젯 -->
    <WidgetRenderer zone="sidebar" excludeIds={['notice', 'celebration']} />

    <!-- Slot: sidebar-right-bottom -->
    {#each getComponentsForSlot('sidebar-right-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- sidebar-sticky (GAM 300x600) -->
    <div class="flex-1">
        <div class="sticky top-[64px]">
            <div class:hidden={!widgetLayoutStore.hasEnabledAds}>
                <AdSlot
                    position="sidebar-sticky-desktop"
                    height="600px"
                    slotKey="sidebar-sticky-desktop"
                />
            </div>
        </div>
    </div>
</div>

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

    <!-- 이용가이드 미니 카드 (마음메시지 아래) — 가로 1줄 콤팩트 -->
    <a
        href="/content/guide"
        class="flex items-center gap-2.5 rounded-xl border bg-teal-50 px-3.5 py-2.5 no-underline transition-colors hover:border-teal-300 dark:bg-teal-950/30"
    >
        <span class="text-xl leading-none">🙌</span>
        <span class="text-foreground text-sm font-bold">다모앙 이용가이드</span>
        <span
            class="ml-auto whitespace-nowrap rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-white"
            >가이드 보기 →</span
        >
    </a>

    <!-- 4분할 배너 (이용가이드 바로 아래로 승격) -->
    <WidgetRenderer zone="sidebar" onlyIds={['sidebar-ad-2']} />

    <!-- 온라인 대전 현황 위젯 (4분할 배너 아래) -->
    <WidgetRenderer zone="sidebar" onlyIds={['game-lobby']} />

    <!-- 사이드바 배너 (슬롯 기반) -->
    <PluginSlot name="sidebar-banner" />

    <!-- 나머지 사이드바 위젯 (4분할 배너는 위로 뺐으므로 제외) -->
    <WidgetRenderer
        zone="sidebar"
        excludeIds={['notice', 'celebration', 'game-lobby', 'sidebar-ad-2']}
    />

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

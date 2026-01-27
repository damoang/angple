<script lang="ts">
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';

    // 위젯 컴포넌트들
    import { RecommendedPosts } from '$lib/components/features/recommended';
    import { NewBoard } from '$lib/components/features/new-board';
    import { EconomyTabs } from '$lib/components/features/economy';
    import { GalleryGrid } from '$lib/components/features/gallery';
    import { GroupTabs } from '$lib/components/features/group';
    import { AdSlot } from '$lib/components/ui/ad-slot';
    import WidgetWrapper from './widget-wrapper.svelte';
    import EditModeToggle from './edit-mode-toggle.svelte';

    import type { NewsPost, EconomyPost, GalleryPost, GroupTabsData } from '$lib/api/types';

    interface Props {
        newsTabs: NewsPost[];
        economyTabs: EconomyPost[];
        gallery: GalleryPost[];
        groupTabs: GroupTabsData | null;
    }

    const { newsTabs, economyTabs, gallery, groupTabs }: Props = $props();

    // 스토어 상태
    const widgets = $derived(widgetLayoutStore.widgets);
    const isEditMode = $derived(widgetLayoutStore.isEditMode);

    // 드래그앤드롭 설정
    const flipDurationMs = 200;

    function handleDndConsider(e: CustomEvent<DndEvent<WidgetConfig>>) {
        widgetLayoutStore.setDragging(true);
        widgetLayoutStore.updateWidgetOrder(e.detail.items);
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<WidgetConfig>>) {
        widgetLayoutStore.setDragging(false);
        widgetLayoutStore.updateWidgetOrder(e.detail.items);
    }

    // 위젯 렌더링 헬퍼
    function getAdPosition(widget: WidgetConfig): string {
        return (widget.settings?.position as string) ?? 'index-custom';
    }

    function getAdHeight(widget: WidgetConfig): string {
        return (widget.settings?.height as string) ?? '90px';
    }
</script>

<div class="space-y-4">
    {#if isEditMode}
        <!-- 편집 모드: 드래그앤드롭 활성화 -->
        <div
            use:dndzone={{
                items: widgets,
                flipDurationMs,
                dropTargetStyle: { outline: '2px dashed #3b82f6', outlineOffset: '2px' }
            }}
            onconsider={handleDndConsider}
            onfinalize={handleDndFinalize}
            class="space-y-4"
        >
            {#each widgets as widget (widget.id)}
                <div animate:flip={{ duration: flipDurationMs }}>
                    <WidgetWrapper {widget}>
                        {#if widget.type === 'ad'}
                            <AdSlot position={getAdPosition(widget)} height={getAdHeight(widget)} />
                        {:else if widget.type === 'recommended'}
                            <RecommendedPosts />
                        {:else if widget.type === 'new-board'}
                            <NewBoard posts={newsTabs} />
                        {:else if widget.type === 'economy'}
                            <EconomyTabs posts={economyTabs} />
                        {:else if widget.type === 'news-economy-row'}
                            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <NewBoard posts={newsTabs} />
                                <EconomyTabs posts={economyTabs} />
                            </div>
                        {:else if widget.type === 'gallery'}
                            <GalleryGrid posts={gallery} />
                        {:else if widget.type === 'group'}
                            <GroupTabs data={groupTabs} />
                        {:else}
                            <div class="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                                알 수 없는 위젯: {widget.type}
                            </div>
                        {/if}
                    </WidgetWrapper>
                </div>
            {/each}
        </div>
    {:else}
        <!-- 일반 모드: 드래그 비활성화 -->
        {#each widgets.filter((w) => w.enabled) as widget (widget.id)}
            {#if widget.type === 'ad'}
                <AdSlot position={getAdPosition(widget)} height={getAdHeight(widget)} />
            {:else if widget.type === 'recommended'}
                <RecommendedPosts />
            {:else if widget.type === 'new-board'}
                <NewBoard posts={newsTabs} />
            {:else if widget.type === 'economy'}
                <EconomyTabs posts={economyTabs} />
            {:else if widget.type === 'news-economy-row'}
                <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <NewBoard posts={newsTabs} />
                    <EconomyTabs posts={economyTabs} />
                </div>
            {:else if widget.type === 'gallery'}
                <GalleryGrid posts={gallery} />
            {:else if widget.type === 'group'}
                <GroupTabs data={groupTabs} />
            {/if}
        {/each}
    {/if}
</div>

<!-- 편집 모드 토글 버튼 -->
<EditModeToggle />

<script lang="ts">
    /**
     * 사이드바 위젯 동적 렌더러
     * widgetLayoutStore에서 사이드바 위젯을 가져와 동적으로 렌더링
     */
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import NoticeWidget from './notice-widget.svelte';
    import PodcastWidget from './podcast-widget.svelte';
    import SharingBoardWidget from './sharing-board-widget.svelte';
    import StickyAdsWidget from './sticky-ads-widget.svelte';
    import CelebrationCardWidget from '$widgets/celebration-card/index.svelte';

    const flipDurationMs = 200;

    // 스토어에서 위젯 목록 가져오기
    const widgets = $derived(widgetLayoutStore.enabledSidebarWidgets);
    const isEditMode = $derived(widgetLayoutStore.isEditMode);

    // 위젯 타입에 따른 컴포넌트 매핑
    function getWidgetComponent(type: string) {
        switch (type) {
            case 'notice':
                return NoticeWidget;
            case 'podcast':
                return PodcastWidget;
            case 'sharing-board':
                return SharingBoardWidget;
            case 'sticky-ads':
                return StickyAdsWidget;
            case 'celebration-card':
                return CelebrationCardWidget;
            default:
                return null;
        }
    }

    // 드래그앤드롭 핸들러
    function handleConsider(e: CustomEvent<DndEvent<WidgetConfig>>) {
        widgetLayoutStore.updateSidebarWidgetOrder(e.detail.items);
    }

    function handleFinalize(e: CustomEvent<DndEvent<WidgetConfig>>) {
        widgetLayoutStore.updateSidebarWidgetOrder(e.detail.items);
        widgetLayoutStore.setDragging(false);
    }

    function handleDragStart() {
        widgetLayoutStore.setDragging(true);
    }
</script>

{#if isEditMode}
    <!-- 편집 모드: 드래그앤드롭 가능 -->
    <div
        class="flex flex-col gap-4"
        use:dndzone={{
            items: widgets,
            flipDurationMs,
            dropTargetStyle: { outline: '2px dashed #3b82f6', borderRadius: '8px' }
        }}
        onconsider={handleConsider}
        onfinalize={handleFinalize}
    >
        {#each widgets as widget (widget.id)}
            {@const Component = getWidgetComponent(widget.type)}
            <div
                class="relative cursor-move"
                role="button"
                tabindex="0"
                onmousedown={handleDragStart}
                ontouchstart={handleDragStart}
            >
                <!-- 드래그 핸들 -->
                <div
                    class="absolute -left-2 -top-2 z-10 rounded-full bg-blue-500 p-1 text-white shadow-lg"
                >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 8h16M4 16h16"
                        />
                    </svg>
                </div>

                <!-- 삭제 버튼 -->
                <button
                    type="button"
                    class="absolute -right-2 -top-2 z-10 rounded-full bg-red-500 p-1 text-white shadow-lg hover:bg-red-600"
                    onclick={(e) => {
                        e.stopPropagation();
                        widgetLayoutStore.removeSidebarWidget(widget.id);
                    }}
                >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>

                <!-- 위젯 컴포넌트 렌더링 -->
                {#if Component}
                    <Component config={widget} slot="sidebar" isEditMode={true} />
                {:else}
                    <div
                        class="rounded-lg border border-dashed border-slate-300 p-4 text-slate-500"
                    >
                        알 수 없는 위젯: {widget.type}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{:else}
    <!-- 일반 모드: 순서대로 렌더링 -->
    <div class="flex flex-col gap-4">
        {#each widgets as widget (widget.id)}
            {@const Component = getWidgetComponent(widget.type)}
            {#if Component}
                <Component config={widget} slot="sidebar" />
            {/if}
        {/each}
    </div>
{/if}

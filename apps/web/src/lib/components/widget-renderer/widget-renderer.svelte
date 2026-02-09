<script lang="ts">
    /**
     * 통합 위젯 렌더러
     *
     * 메인 영역과 사이드바 모두에서 사용 가능한 단일 렌더러입니다.
     * import.meta.glob으로 발견된 위젯 컴포넌트를 동적으로 로드합니다.
     */
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { loadWidgetComponent } from '$lib/utils/widget-component-loader';
    import type { Component } from 'svelte';
    import { SvelteMap } from 'svelte/reactivity';
    import WidgetWrapper from './widget-wrapper.svelte';

    interface Props {
        /** 렌더링할 위젯 존 */
        zone: 'main' | 'sidebar';
        /** SSR prefetch 데이터 맵 (위젯 타입 → 데이터) */
        prefetchDataMap?: Record<string, unknown>;
    }

    const { zone, prefetchDataMap = {} }: Props = $props();

    // 존별 위젯 목록
    const widgets = $derived(
        zone === 'sidebar' ? widgetLayoutStore.sidebarWidgets : widgetLayoutStore.widgets
    );
    const enabledWidgets = $derived(
        zone === 'sidebar'
            ? widgetLayoutStore.enabledSidebarWidgets
            : widgetLayoutStore.enabledWidgets
    );
    const isEditMode = $derived(widgetLayoutStore.isEditMode);

    // 드래그앤드롭 설정
    const flipDurationMs = 200;

    function handleDndConsider(e: CustomEvent<DndEvent<WidgetConfig>>) {
        widgetLayoutStore.setDragging(true);
        if (zone === 'sidebar') {
            widgetLayoutStore.updateSidebarWidgetOrder(e.detail.items);
        } else {
            widgetLayoutStore.updateWidgetOrder(e.detail.items);
        }
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<WidgetConfig>>) {
        widgetLayoutStore.setDragging(false);
        if (zone === 'sidebar') {
            widgetLayoutStore.updateSidebarWidgetOrder(e.detail.items);
        } else {
            widgetLayoutStore.updateWidgetOrder(e.detail.items);
        }
    }

    // 위젯 컴포넌트 캐시
    const componentCache = new SvelteMap<string, Component | null>();
    let loadedComponents = new SvelteMap<string, Component | null>();

    // 위젯 타입이 변경될 때마다 컴포넌트 로드
    $effect(() => {
        const types = new Set(widgets.map((w) => w.type));
        for (const type of types) {
            if (!componentCache.has(type)) {
                loadWidgetComponent(type).then((component) => {
                    componentCache.set(type, component);
                    // SvelteMap is reactive, just copy entries to trigger updates
                    loadedComponents.set(type, component);
                });
            }
        }
    });

    function getComponent(type: string): Component | null {
        return loadedComponents.get(type) ?? null;
    }

    // 편집 모드에서는 전체 위젯, 일반 모드에서는 활성화된 위젯만
    const displayWidgets = $derived(isEditMode ? widgets : enabledWidgets);
</script>

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
        class={zone === 'sidebar' ? 'flex flex-col gap-4' : 'space-y-4'}
    >
        {#each widgets as widget (widget.id)}
            {@const WidgetComponent = getComponent(widget.type)}
            <div animate:flip={{ duration: flipDurationMs }}>
                <WidgetWrapper {widget} {zone}>
                    {#if WidgetComponent}
                        <WidgetComponent
                            config={widget}
                            slot={zone}
                            isEditMode={true}
                            prefetchData={prefetchDataMap[widget.type]}
                        />
                    {:else}
                        <div
                            class="border-border bg-background text-muted-foreground flex items-center justify-center rounded-lg border p-4 text-center text-sm"
                        >
                            로딩 중...
                        </div>
                    {/if}
                </WidgetWrapper>
            </div>
        {/each}
    </div>
{:else}
    <!-- 일반 모드 -->
    <div class={zone === 'sidebar' ? 'flex flex-col gap-4' : 'space-y-4'}>
        {#each enabledWidgets as widget (widget.id)}
            {@const WidgetComponent = getComponent(widget.type)}
            {#if WidgetComponent}
                <WidgetComponent
                    config={widget}
                    slot={zone}
                    isEditMode={false}
                    prefetchData={prefetchDataMap[widget.type]}
                />
            {/if}
        {/each}
    </div>
{/if}

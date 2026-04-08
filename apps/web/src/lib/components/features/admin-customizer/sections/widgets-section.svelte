<script lang="ts">
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import { dndzone } from 'svelte-dnd-action';

    type WidgetZoneTab = 'main' | 'sidebar';
    let activeZone = $state<WidgetZoneTab>('main');

    // DnD용 로컬 상태 ($state)
    let mainDndItems = $state<WidgetConfig[]>([]);
    let sidebarDndItems = $state<WidgetConfig[]>([]);
    let mainDndKey = $state(0);
    let sidebarDndKey = $state(0);

    // 소스 데이터 변경 시 동기화
    $effect(() => {
        const widgets = widgetLayoutStore.widgets;
        mainDndItems = widgets
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((w) => ({ ...w }));
        mainDndKey++;
    });

    $effect(() => {
        const widgets = widgetLayoutStore.sidebarWidgets;
        sidebarDndItems = widgets
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((w) => ({ ...w }));
        sidebarDndKey++;
    });

    function handleMainConsider(e: CustomEvent<{ items: WidgetConfig[] }>) {
        mainDndItems = e.detail.items;
    }

    function handleMainFinalize(e: CustomEvent<{ items: WidgetConfig[] }>) {
        mainDndItems = e.detail.items;
        widgetLayoutStore.updateWidgetOrder(mainDndItems);
    }

    function handleSidebarConsider(e: CustomEvent<{ items: WidgetConfig[] }>) {
        sidebarDndItems = e.detail.items;
    }

    function handleSidebarFinalize(e: CustomEvent<{ items: WidgetConfig[] }>) {
        sidebarDndItems = e.detail.items;
        widgetLayoutStore.updateSidebarWidgetOrder(sidebarDndItems);
    }

    function toggleWidget(zone: WidgetZoneTab, id: string) {
        if (zone === 'main') {
            widgetLayoutStore.toggleWidget(id);
        } else {
            widgetLayoutStore.toggleSidebarWidget(id);
        }
    }

    function removeWidget(zone: WidgetZoneTab, id: string) {
        if (zone === 'main') {
            widgetLayoutStore.removeWidget(id);
        } else {
            widgetLayoutStore.removeSidebarWidget(id);
        }
    }

    function handleReset() {
        if (confirm('기본 레이아웃으로 초기화하시겠습니까?')) {
            widgetLayoutStore.resetToDefault();
        }
    }

    // 위젯 타입 한글 이름
    function getWidgetLabel(type: string): string {
        const labels: Record<string, string> = {
            'post-list': '게시글 목록',
            'ad-slot': '광고',
            recommended: '공감글',
            celebration: '축하메시지',
            'latest-posts': '최신글',
            'popular-posts': '인기글',
            search: '검색',
            banner: '배너',
            profile: '프로필',
            calendar: '캘린더',
            tags: '태그',
            links: '링크'
        };
        return labels[type] || type;
    }
</script>

<div class="flex flex-col gap-3 p-4">
    <!-- 영역 탭 -->
    <div class="flex gap-1 rounded-md bg-slate-100 p-1 dark:bg-slate-800">
        <button
            type="button"
            onclick={() => (activeZone = 'main')}
            class="flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors {activeZone ===
            'main'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}"
        >
            메인 영역
        </button>
        <button
            type="button"
            onclick={() => (activeZone = 'sidebar')}
            class="flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors {activeZone ===
            'sidebar'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}"
        >
            사이드바
        </button>
    </div>

    <!-- 초기화 버튼 -->
    <button
        type="button"
        onclick={handleReset}
        class="text-muted-foreground hover:text-foreground flex items-center gap-1 self-end text-xs transition-colors"
    >
        <RotateCcw class="h-3 w-3" />
        기본값 초기화
    </button>

    <!-- 메인 영역 위젯 -->
    {#if activeZone === 'main'}
        {#if mainDndItems.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">위젯이 없습니다.</p>
        {:else}
            {#key mainDndKey}
                <div
                    use:dndzone={{ items: mainDndItems, flipDurationMs: 200, type: 'main-widgets' }}
                    onconsider={handleMainConsider}
                    onfinalize={handleMainFinalize}
                    class="flex flex-col gap-1"
                >
                    {#each mainDndItems as widget (widget.id)}
                        <div
                            class="bg-background border-border flex items-center gap-2 rounded-md border px-3 py-2"
                        >
                            <GripVertical
                                class="text-muted-foreground h-4 w-4 shrink-0 cursor-grab"
                            />
                            <span class="flex-1 truncate text-sm"
                                >{getWidgetLabel(widget.type)}</span
                            >
                            <button
                                type="button"
                                onclick={() => toggleWidget('main', widget.id)}
                                class="rounded px-1.5 py-0.5 text-xs transition-colors {widget.enabled
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'}"
                            >
                                {widget.enabled ? 'ON' : 'OFF'}
                            </button>
                            <button
                                type="button"
                                onclick={() => removeWidget('main', widget.id)}
                                class="text-muted-foreground hover:text-destructive p-0.5 transition-colors"
                                title="삭제"
                            >
                                <Trash2 class="h-3.5 w-3.5" />
                            </button>
                        </div>
                    {/each}
                </div>
            {/key}
        {/if}
    {:else}
        <!-- 사이드바 위젯 -->
        {#if sidebarDndItems.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">사이드바 위젯이 없습니다.</p>
        {:else}
            {#key sidebarDndKey}
                <div
                    use:dndzone={{
                        items: sidebarDndItems,
                        flipDurationMs: 200,
                        type: 'sidebar-widgets'
                    }}
                    onconsider={handleSidebarConsider}
                    onfinalize={handleSidebarFinalize}
                    class="flex flex-col gap-1"
                >
                    {#each sidebarDndItems as widget (widget.id)}
                        <div
                            class="bg-background border-border flex items-center gap-2 rounded-md border px-3 py-2"
                        >
                            <GripVertical
                                class="text-muted-foreground h-4 w-4 shrink-0 cursor-grab"
                            />
                            <span class="flex-1 truncate text-sm"
                                >{getWidgetLabel(widget.type)}</span
                            >
                            <button
                                type="button"
                                onclick={() => toggleWidget('sidebar', widget.id)}
                                class="rounded px-1.5 py-0.5 text-xs transition-colors {widget.enabled
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'}"
                            >
                                {widget.enabled ? 'ON' : 'OFF'}
                            </button>
                            <button
                                type="button"
                                onclick={() => removeWidget('sidebar', widget.id)}
                                class="text-muted-foreground hover:text-destructive p-0.5 transition-colors"
                                title="삭제"
                            >
                                <Trash2 class="h-3.5 w-3.5" />
                            </button>
                        </div>
                    {/each}
                </div>
            {/key}
        {/if}
    {/if}
</div>

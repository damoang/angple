<script lang="ts">
    import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME, TRIGGERS } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { widgetStore } from '$lib/stores/widget-store.svelte';
    import { getWidgetName, getWidgetIcon, WIDGET_REGISTRY } from '$lib/types/widget';
    import { cn } from '$lib/utils';
    import { Switch } from '$lib/components/ui/switch';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import {
        GripVertical,
        Trash2,
        Settings,
        Star,
        Newspaper,
        ShoppingCart,
        LayoutGrid,
        Images,
        Users,
        Megaphone,
        Info,
        Play,
        Image,
        Gift,
        Pin,
        Box
    } from '@lucide/svelte/icons';

    /**
     * 위젯 목록 테이블 컴포넌트
     *
     * 드래그앤드롭으로 위젯 순서를 변경할 수 있습니다.
     */

    // 아이콘 매핑
    const iconMap: Record<string, typeof Star> = {
        Star,
        Newspaper,
        ShoppingCart,
        LayoutGrid,
        Images,
        Users,
        Megaphone,
        Info,
        Play,
        Image,
        Gift,
        Pin,
        Box
    };

    // 파생 상태
    const widgets = $derived(widgetStore.currentWidgets);
    const selectedWidgetId = $derived(widgetStore.selectedWidgetId);
    const selectedZone = $derived(widgetStore.selectedZone);

    // dnd 항목 (id를 dnd용으로 변환)
    let items = $state(widgets.map((w) => ({ ...w })));

    // widgets 변경 시 items 동기화
    $effect(() => {
        items = widgets.map((w) => ({ ...w }));
    });

    // 드래그 핸들러
    function handleDndConsider(e: CustomEvent<{ items: typeof items; info: { trigger: string } }>) {
        items = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<{ items: typeof items; info: { trigger: string } }>) {
        items = e.detail.items;
        // shadow item 제거 후 스토어 업데이트
        const cleanItems = items.filter((item) => !(SHADOW_ITEM_MARKER_PROPERTY_NAME in item));
        widgetStore.updateWidgetOrder(cleanItems);
    }

    // 토글 핸들러
    function handleToggle(widgetId: string) {
        widgetStore.toggleWidget(widgetId);
    }

    // 삭제 핸들러
    function handleDelete(widgetId: string) {
        if (confirm('이 위젯을 삭제하시겠습니까?')) {
            widgetStore.removeWidget(widgetId);
        }
    }

    // 선택 핸들러
    function handleSelect(widgetId: string) {
        widgetStore.selectWidget(widgetId);
    }

    // 아이콘 컴포넌트 가져오기
    function getIcon(type: string) {
        const iconName = getWidgetIcon(type);
        return iconMap[iconName] || Box;
    }

    // 카테고리 배지 색상
    function getCategoryVariant(
        category: string
    ): 'default' | 'secondary' | 'destructive' | 'outline' {
        switch (category) {
            case 'content':
                return 'default';
            case 'ad':
                return 'destructive';
            case 'layout':
                return 'secondary';
            case 'sidebar':
                return 'outline';
            default:
                return 'default';
        }
    }

    // 카테고리 레이블
    function getCategoryLabel(category: string): string {
        switch (category) {
            case 'content':
                return '콘텐츠';
            case 'ad':
                return '광고';
            case 'layout':
                return '레이아웃';
            case 'sidebar':
                return '사이드바';
            default:
                return category;
        }
    }

    const flipDurationMs = 200;
</script>

<div class="space-y-1">
    <!-- 헤더 -->
    <div
        class="text-muted-foreground grid grid-cols-[40px_1fr_100px_80px_100px] gap-4 border-b px-4 py-2 text-sm font-medium"
    >
        <div></div>
        <div>위젯</div>
        <div>카테고리</div>
        <div class="text-center">활성화</div>
        <div class="text-right">작업</div>
    </div>

    <!-- 목록 -->
    <div
        use:dndzone={{
            items,
            flipDurationMs,
            dropTargetStyle: {},
            dragDisabled: false
        }}
        onconsider={handleDndConsider}
        onfinalize={handleDndFinalize}
        class="space-y-1"
    >
        {#each items as widget (widget.id)}
            {@const Icon = getIcon(widget.type)}
            {@const registry = WIDGET_REGISTRY[widget.type]}
            {@const isSelected = selectedWidgetId === widget.id}
            {@const isShadow = SHADOW_ITEM_MARKER_PROPERTY_NAME in widget}
            <div
                animate:flip={{ duration: flipDurationMs }}
                class={cn(
                    'grid grid-cols-[40px_1fr_100px_80px_100px] items-center gap-4 rounded-lg border px-4 py-3 transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50',
                    isShadow && 'opacity-50',
                    !widget.enabled && 'opacity-60'
                )}
            >
                <!-- 드래그 핸들 -->
                <div class="cursor-grab active:cursor-grabbing">
                    <GripVertical class="text-muted-foreground h-5 w-5" />
                </div>

                <!-- 위젯 정보 -->
                <button
                    type="button"
                    onclick={() => handleSelect(widget.id)}
                    class="flex items-center gap-3 text-left"
                >
                    <div
                        class={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            widget.enabled
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                        )}
                    >
                        <Icon class="h-5 w-5" />
                    </div>
                    <div>
                        <div class="font-medium">{getWidgetName(widget.type)}</div>
                        <div class="text-muted-foreground text-sm">
                            {registry?.description ?? ''}
                        </div>
                    </div>
                </button>

                <!-- 카테고리 -->
                <div>
                    {#if registry}
                        <Badge variant={getCategoryVariant(registry.category)}>
                            {getCategoryLabel(registry.category)}
                        </Badge>
                    {/if}
                </div>

                <!-- 활성화 토글 -->
                <div class="flex justify-center">
                    <Switch
                        checked={widget.enabled}
                        onCheckedChange={() => handleToggle(widget.id)}
                    />
                </div>

                <!-- 작업 버튼 -->
                <div class="flex justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => handleSelect(widget.id)}
                        title="설정"
                    >
                        <Settings class="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => handleDelete(widget.id)}
                        title="삭제"
                        class="hover:text-destructive"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        {/each}
    </div>
</div>

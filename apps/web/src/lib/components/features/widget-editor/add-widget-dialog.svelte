<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle,
        DialogTrigger,
        DialogClose
    } from '$lib/components/ui/dialog';
    import { Button } from '$lib/components/ui/button';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { getWidgetRegistry, getAddableWidgets } from '$lib/utils/widget-component-loader';
    import Plus from '@lucide/svelte/icons/plus';
    import Star from '@lucide/svelte/icons/star';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import Images from '@lucide/svelte/icons/image';
    import Users from '@lucide/svelte/icons/users';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Box from '@lucide/svelte/icons/box';
    import Info from '@lucide/svelte/icons/info';
    import Play from '@lucide/svelte/icons/play';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Gift from '@lucide/svelte/icons/gift';
    import Pin from '@lucide/svelte/icons/pin';

    interface Props {
        forSidebar?: boolean;
    }

    const { forSidebar = false }: Props = $props();

    let open = $state(false);

    const WIDGET_REGISTRY = $derived(getWidgetRegistry());
    const slot = $derived(forSidebar ? 'sidebar' : 'main') as 'main' | 'sidebar';
    const currentWidgetTypes = $derived(
        forSidebar
            ? widgetLayoutStore.sidebarWidgets.map((w) => w.type)
            : widgetLayoutStore.widgets.map((w) => w.type)
    );
    const addableWidgets = $derived(getAddableWidgets(currentWidgetTypes, slot));

    // 아이콘 매핑
    const iconComponents: Record<string, typeof Star> = {
        Star,
        Newspaper,
        ShoppingCart,
        LayoutGrid,
        Images,
        Users,
        Megaphone,
        Box,
        Info,
        Play,
        Image: ImageIcon,
        Gift,
        Pin
    };

    function getIcon(iconName: string) {
        return iconComponents[iconName] ?? Box;
    }

    function handleAddWidget(type: string) {
        const entry = WIDGET_REGISTRY[type];
        if (forSidebar) {
            widgetLayoutStore.addSidebarWidget(type, entry?.defaultSettings);
        } else {
            widgetLayoutStore.addWidget(type, entry?.defaultSettings);
        }
        open = false;
    }

    // 카테고리별 그룹화
    const groupedWidgets = $derived.by(() => {
        const groups: Record<string, string[]> = {};

        for (const type of addableWidgets) {
            const entry = WIDGET_REGISTRY[type];
            if (entry) {
                const cat = entry.category;
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(type);
            }
        }

        return groups;
    });

    const categoryNames: Record<string, string> = {
        content: '콘텐츠',
        layout: '레이아웃',
        ad: '광고',
        sidebar: '사이드바',
        social: '소셜',
        utility: '유틸리티'
    };
</script>

<Dialog bind:open>
    <DialogTrigger>
        <Button variant="outline" size="sm" class="gap-1">
            <Plus class="h-4 w-4" />
            위젯 추가
        </Button>
    </DialogTrigger>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>위젯 추가</DialogTitle>
            <DialogDescription>
                {forSidebar ? '사이드바' : '메인 페이지'}에 추가할 위젯을 선택하세요.
            </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
            {#each Object.entries(groupedWidgets) as [category, types]}
                {#if types.length > 0}
                    <div>
                        <h4 class="text-muted-foreground mb-2 text-sm font-medium">
                            {categoryNames[category] ?? category}
                        </h4>
                        <div class="grid grid-cols-2 gap-2">
                            {#each types as type}
                                {@const entry = WIDGET_REGISTRY[type]}
                                {@const Icon = getIcon(entry.icon)}
                                <button
                                    type="button"
                                    onclick={() => handleAddWidget(type)}
                                    class="border-border hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-lg border p-3 text-left transition-colors"
                                >
                                    <div
                                        class="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                                    >
                                        <Icon class="h-4 w-4" />
                                    </div>
                                    <div class="min-w-0">
                                        <div class="truncate text-sm font-medium">{entry.name}</div>
                                        <div class="text-muted-foreground truncate text-xs">
                                            {entry.description}
                                        </div>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}

            {#if addableWidgets.length === 0}
                <p class="text-muted-foreground py-4 text-center text-sm">
                    추가할 수 있는 위젯이 없습니다.
                </p>
            {/if}
        </div>

        <div class="flex justify-end">
            <DialogClose>
                <Button variant="ghost">닫기</Button>
            </DialogClose>
        </div>
    </DialogContent>
</Dialog>

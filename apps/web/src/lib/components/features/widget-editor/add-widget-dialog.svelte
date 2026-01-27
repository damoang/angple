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
    import { WIDGET_REGISTRY, getAddableWidgets } from './registry';
    import Plus from '@lucide/svelte/icons/plus';
    import Star from '@lucide/svelte/icons/star';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import Images from '@lucide/svelte/icons/image';
    import Users from '@lucide/svelte/icons/users';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Box from '@lucide/svelte/icons/box';

    let open = $state(false);

    const currentWidgetTypes = $derived(widgetLayoutStore.widgets.map((w) => w.type));
    const addableWidgets = $derived(getAddableWidgets(currentWidgetTypes));

    // 아이콘 매핑
    const iconComponents: Record<string, typeof Star> = {
        Star,
        Newspaper,
        ShoppingCart,
        LayoutGrid,
        Images,
        Users,
        Megaphone,
        Box
    };

    function getIcon(iconName: string) {
        return iconComponents[iconName] ?? Box;
    }

    function handleAddWidget(type: string) {
        const entry = WIDGET_REGISTRY[type];
        widgetLayoutStore.addWidget(type, entry?.defaultSettings);
        open = false;
    }

    // 카테고리별 그룹화
    const groupedWidgets = $derived(() => {
        const groups: Record<string, string[]> = {
            content: [],
            layout: [],
            ad: []
        };

        for (const type of addableWidgets) {
            const entry = WIDGET_REGISTRY[type];
            if (entry) {
                groups[entry.category].push(type);
            }
        }

        return groups;
    });

    const categoryNames: Record<string, string> = {
        content: '콘텐츠',
        layout: '레이아웃',
        ad: '광고'
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
            <DialogDescription>메인 페이지에 추가할 위젯을 선택하세요.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
            {#each Object.entries(groupedWidgets()) as [category, types]}
                {#if types.length > 0}
                    <div>
                        <h4 class="text-sm font-medium text-muted-foreground mb-2">
                            {categoryNames[category]}
                        </h4>
                        <div class="grid grid-cols-2 gap-2">
                            {#each types as type}
                                {@const entry = WIDGET_REGISTRY[type]}
                                {@const Icon = getIcon(entry.icon)}
                                <button
                                    type="button"
                                    onclick={() => handleAddWidget(type)}
                                    class="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                                >
                                    <div
                                        class="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center"
                                    >
                                        <Icon class="h-4 w-4" />
                                    </div>
                                    <div class="min-w-0">
                                        <div class="text-sm font-medium truncate">{entry.name}</div>
                                        <div class="text-xs text-muted-foreground truncate">
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
                <p class="text-sm text-muted-foreground text-center py-4">
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

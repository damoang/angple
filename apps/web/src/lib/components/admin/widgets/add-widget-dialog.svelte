<script lang="ts">
    import { widgetStore } from '$lib/stores/admin-widget-store.svelte';
    import { WIDGET_REGISTRY, getAddableWidgets, getWidgetIcon, getWidgetName } from '$lib/types/admin-widget';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { cn } from '$lib/utils';
    import {
        Plus, Star, Newspaper, ShoppingCart, LayoutGrid, Images, Users,
        Megaphone, Info, Play, Image, Gift, Pin, Box
    } from '@lucide/svelte/icons';

    let { open = $bindable(false) } = $props<{ open?: boolean }>();

    const iconMap: Record<string, typeof Star> = {
        Star, Newspaper, ShoppingCart, LayoutGrid, Images, Users,
        Megaphone, Info, Play, Image, Gift, Pin, Box
    };

    const selectedZone = $derived(widgetStore.selectedZone);
    const currentWidgetTypes = $derived(widgetStore.currentWidgets.map((w) => w.type));
    const addableWidgets = $derived(getAddableWidgets(currentWidgetTypes, selectedZone === 'sidebar'));

    function handleSelectWidget(type: string) {
        const registry = WIDGET_REGISTRY[type];
        widgetStore.addWidget(type, registry?.defaultSettings);
        open = false;
    }

    function getIcon(type: string) {
        const iconName = getWidgetIcon(type);
        return iconMap[iconName] || Box;
    }

    function getCategoryVariant(category: string): 'default' | 'secondary' | 'destructive' | 'outline' {
        switch (category) {
            case 'content': return 'default';
            case 'ad': return 'destructive';
            case 'layout': return 'secondary';
            case 'sidebar': return 'outline';
            default: return 'default';
        }
    }

    function getCategoryLabel(category: string): string {
        switch (category) {
            case 'content': return '콘텐츠';
            case 'ad': return '광고';
            case 'layout': return '레이아웃';
            case 'sidebar': return '사이드바';
            default: return category;
        }
    }

    const groupedWidgets = $derived(() => {
        const groups: Record<string, string[]> = { content: [], layout: [], ad: [], sidebar: [] };
        for (const type of addableWidgets) {
            const registry = WIDGET_REGISTRY[type];
            if (registry) { groups[registry.category].push(type); }
        }
        return groups;
    });

    const categoryOrder = ['content', 'layout', 'ad', 'sidebar'] as const;
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>위젯 추가</Dialog.Title>
            <Dialog.Description>
                {selectedZone === 'main' ? '메인 영역' : '사이드바'}에 추가할 위젯을 선택하세요
            </Dialog.Description>
        </Dialog.Header>

        <div class="max-h-[60vh] overflow-auto py-4">
            {#if addableWidgets.length === 0}
                <div class="text-muted-foreground py-8 text-center">
                    추가할 수 있는 위젯이 없습니다.
                    <br />
                    <span class="text-sm">(모든 위젯이 이미 추가되었거나, 이 영역에 맞는 위젯이 없습니다)</span>
                </div>
            {:else}
                {#each categoryOrder as category}
                    {@const widgets = groupedWidgets()[category]}
                    {#if widgets.length > 0}
                        <div class="mb-6">
                            <h4 class="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">{getCategoryLabel(category)}</h4>
                            <div class="grid grid-cols-2 gap-3">
                                {#each widgets as type (type)}
                                    {@const Icon = getIcon(type)}
                                    {@const registry = WIDGET_REGISTRY[type]}
                                    <button type="button" onclick={() => handleSelectWidget(type)} class={cn('hover:border-primary hover:bg-primary/5 flex items-start gap-3 rounded-lg border p-4 text-left transition-colors')}>
                                        <div class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                            <Icon class="h-5 w-5" />
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-center gap-2">
                                                <span class="font-medium">{getWidgetName(type)}</span>
                                                {#if registry?.allowMultiple}
                                                    <Badge variant="outline" class="text-xs">복수</Badge>
                                                {/if}
                                            </div>
                                            <p class="text-muted-foreground mt-1 line-clamp-2 text-sm">{registry?.description ?? ''}</p>
                                        </div>
                                        <Plus class="text-muted-foreground h-5 w-5 shrink-0" />
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            {/if}
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => (open = false)}>취소</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<script lang="ts">
    import { page } from '$app/stores';
    import {
        Accordion,
        AccordionItem,
        AccordionTrigger,
        AccordionContent
    } from '$lib/components/ui/accordion';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { menuStore } from '$lib/stores/menu.svelte';

    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { getIcon } from '$lib/utils/icon-map';

    import UserWidget from './user-widget.svelte';
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { boardFavoritesStore, slotLabel } from '$lib/stores/board-favorites.svelte';

    let isCollapsed = $state(false);

    // 메뉴 데이터는 SSR에서 초기화된 스토어에서 가져옴
    const menuData = $derived(menuStore.menus.filter((m) => m.show_in_sidebar !== false));
    const loading = $derived(menuStore.loading);
    const error = $derived(menuStore.error);

    // Current path tracking for active menu highlighting
    const currentPath = $derived($page.url.pathname);

    function isActive(url: string): boolean {
        if (!url) return false;
        return currentPath === url || currentPath.startsWith(url + '/');
    }

    // Writable state for accordion — allows both auto-open and manual interaction
    let accordionValue = $state<string | undefined>(undefined);

    // Auto-open the accordion group containing the active menu when path or menu data changes
    // depth 2/3까지 재귀 탐색하여 활성 메뉴 포함 그룹을 자동 오픈
    $effect(() => {
        const hasActiveChild = (items: typeof menuData): boolean =>
            items.some((c) => isActive(c.url) || (c.children && hasActiveChild(c.children)));

        for (const menu of menuData) {
            if (menu.children && hasActiveChild(menu.children)) {
                accordionValue = `item-${menu.id}`;
                return;
            }
        }
    });

    // 2/3depth 그룹 접기/펼치기 상태
    let expandedGroups = $state<Set<number>>(new Set());

    function toggleSubGroup(id: number) {
        const next = new Set(expandedGroups);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        expandedGroups = next;
    }

    // 2depth 하위에 활성 메뉴가 있으면 자동 펼침
    $effect(() => {
        const autoExpand = new Set<number>();
        const check = (items: typeof menuData) => {
            for (const item of items) {
                if (item.children?.length) {
                    const childActive = item.children.some(
                        (c) => isActive(c.url) || c.children?.some((gc) => isActive(gc.url))
                    );
                    if (childActive) autoExpand.add(item.id);
                    check(item.children);
                }
            }
        };
        for (const menu of menuData) {
            if (menu.children) check(menu.children);
        }
        if (autoExpand.size > 0) expandedGroups = autoExpand;
    });

    // 메뉴 필터링과 로딩은 menuStore에서 SSR로 처리됨
</script>

<div
    data-collapsed={isCollapsed}
    class="group flex flex-col gap-4 py-2 pe-3 data-[collapsed=true]:py-2"
>
    <!-- Slot: sidebar-left-top -->
    {#each getComponentsForSlot('sidebar-left-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <div class="px-2">
        <UserWidget />
    </div>

    <!-- 즐겨찾기 단축키 메뉴 (2열 그리드) -->
    {#if boardFavoritesStore.normalSlots.length > 0 || boardFavoritesStore.shiftSlots.length > 0}
        <div class="px-2">
            <div class="text-muted-foreground mb-1.5 text-xs font-semibold">즐겨찾기</div>
            <!-- 일반 슬롯 (1-0): 2열 -->
            <div class="grid grid-cols-2 gap-0.5">
                {#each boardFavoritesStore.normalSlots as { slot, entry } (slot)}
                    {@const active = isActive(`/${entry.boardId}`)}
                    <a
                        href="/{entry.boardId}"
                        class={cn(
                            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors',
                            active
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-accent text-muted-foreground'
                        )}
                    >
                        <kbd
                            class={cn(
                                'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded border px-0.5 font-mono text-[9px] font-medium',
                                active
                                    ? 'border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground'
                                    : 'bg-primary text-primary-foreground'
                            )}>{slotLabel(slot)}</kbd
                        >
                        <span class="truncate">{entry.title}</span>
                    </a>
                {/each}
            </div>
            <!-- Shift 슬롯 (S+1 ~ S+0): 접기/펼치기 -->
            {#if boardFavoritesStore.shiftSlots.length > 0}
                {@const hasShiftActive = boardFavoritesStore.shiftSlots.some(({ entry }) =>
                    isActive(`/${entry.boardId}`)
                )}
                <details class="mt-1" open={hasShiftActive || undefined}>
                    <summary
                        class="text-muted-foreground hover:text-foreground flex cursor-pointer select-none items-center gap-1 px-2 py-1 text-[10px] transition-colors"
                    >
                        <ChevronRight
                            class="h-3 w-3 transition-transform duration-200 [[open]_&]:rotate-90"
                        />
                        추가 단축키 ({boardFavoritesStore.shiftSlots.length})
                    </summary>
                    <div class="mt-0.5 grid grid-cols-2 gap-0.5">
                        {#each boardFavoritesStore.shiftSlots as { slot, entry } (slot)}
                            {@const active = isActive(`/${entry.boardId}`)}
                            <a
                                href="/{entry.boardId}"
                                class={cn(
                                    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors',
                                    active
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent text-muted-foreground'
                                )}
                            >
                                <kbd
                                    class={cn(
                                        'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded border px-0.5 font-mono text-[9px] font-medium',
                                        active
                                            ? 'border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground'
                                            : 'bg-primary text-primary-foreground'
                                    )}>{slotLabel(slot)}</kbd
                                >
                                <span class="truncate">{entry.title}</span>
                            </a>
                        {/each}
                    </div>
                </details>
            {/if}
        </div>
    {/if}

    <nav
        class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
    >
        {#if loading}
            <div class="text-muted-foreground text-center text-sm">메뉴 로딩 중...</div>
        {:else if error}
            <div class="text-destructive text-center text-sm">{error}</div>
        {:else}
            <Accordion type="single" class="w-full" bind:value={accordionValue}>
                {#each menuData as menu (menu.id)}
                    {@const IconComponent = getIcon(menu.icon)}
                    {#if menu.children && menu.children.length > 0}
                        <!-- 하위 메뉴가 있는 경우 -->
                        <AccordionItem value={`item-${menu.id}`} class="border-none">
                            <AccordionTrigger
                                class={cn(
                                    'cursor-pointer',
                                    'hover:no-underline',
                                    isCollapsed &&
                                        'flex justify-center [&[data-state=open]>div>svg.lucide-chevron-down]:hidden'
                                )}
                            >
                                <div class="flex items-center gap-2">
                                    <IconComponent class="text-muted-foreground size-5" />
                                    <span class={cn('font-semibold', isCollapsed && 'hidden')}
                                        >{menu.title}</span
                                    >
                                </div>
                            </AccordionTrigger>
                            <AccordionContent class="pb-1">
                                <div class="relative ms-2 overflow-hidden rounded-lg p-[1px]">
                                    <div
                                        class="from-border absolute inset-0 rounded-lg bg-gradient-to-r to-transparent to-[4%]"
                                    ></div>
                                    <div
                                        class="bg-background relative space-y-1 rounded-lg py-1 ps-1"
                                    >
                                        {#each menu.children as child (child.id)}
                                            {@const ChildIcon = getIcon(child.icon)}
                                            {@const active = isActive(child.url)}
                                            {#if child.children && child.children.length > 0}
                                                <!-- 2depth: 하위 메뉴가 있는 그룹 -->
                                                <div>
                                                    <button
                                                        type="button"
                                                        onclick={() => toggleSubGroup(child.id)}
                                                        class={cn(
                                                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                            'hover:bg-accent text-muted-foreground'
                                                        )}
                                                    >
                                                        <ChildIcon class="size-4" />
                                                        <span class="flex-1 text-left"
                                                            >{child.title}</span
                                                        >
                                                        <ChevronRight
                                                            class={cn(
                                                                'size-3.5 transition-transform duration-200',
                                                                expandedGroups.has(child.id) &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </button>
                                                    {#if expandedGroups.has(child.id)}
                                                        <div
                                                            class="border-border/50 ms-3 space-y-0.5 border-l py-0.5 ps-2"
                                                        >
                                                            {#each child.children as grandchild (grandchild.id)}
                                                                {@const GcIcon = getIcon(
                                                                    grandchild.icon
                                                                )}
                                                                {@const gcActive = isActive(
                                                                    grandchild.url
                                                                )}
                                                                <Button
                                                                    variant={gcActive
                                                                        ? 'default'
                                                                        : 'ghost'}
                                                                    size="sm"
                                                                    class={cn(
                                                                        'h-8 w-full justify-start gap-2 text-xs',
                                                                        gcActive
                                                                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                                            : 'hover:bg-accent'
                                                                    )}
                                                                    href={grandchild.url}
                                                                    rel="external"
                                                                >
                                                                    <GcIcon class="size-3.5" />
                                                                    {grandchild.title}
                                                                    {#if grandchild.shortcut}
                                                                        <kbd
                                                                            class="bg-muted text-muted-foreground ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded border px-0.5 font-mono text-[9px] font-medium"
                                                                            >{grandchild.shortcut}</kbd
                                                                        >
                                                                    {/if}
                                                                </Button>
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                </div>
                                            {:else}
                                                <!-- 2depth: 단독 메뉴 (기존) -->
                                                <Button
                                                    variant={active ? 'default' : 'ghost'}
                                                    class={cn(
                                                        'w-full justify-start gap-2',
                                                        active
                                                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                            : 'hover:bg-accent'
                                                    )}
                                                    href={child.url}
                                                    rel="external"
                                                >
                                                    <ChildIcon class="size-4" />
                                                    {child.title}
                                                    {#if child.shortcut}
                                                        <kbd
                                                            class="bg-muted text-muted-foreground ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] font-medium"
                                                            >{child.shortcut}</kbd
                                                        >
                                                    {/if}
                                                </Button>
                                            {/if}
                                        {/each}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    {:else}
                        <!-- 하위 메뉴가 없는 단독 메뉴 -->
                        {@const active = isActive(menu.url)}
                        <Button
                            variant={active ? 'default' : 'ghost'}
                            class={cn(
                                'w-full justify-start gap-2',
                                active
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'hover:bg-accent'
                            )}
                            href={menu.url}
                            rel="external"
                        >
                            <IconComponent class="size-5" />
                            <span class={cn(isCollapsed && 'hidden')}>{menu.title}</span>
                        </Button>
                    {/if}
                {/each}
            </Accordion>
        {/if}
    </nav>

    <!-- 사이드바 메뉴 아래 GAM 광고 (항상 마운트 — SPA 이동 시 리프레시 방지) -->
    <div class="px-2" class:hidden={!widgetLayoutStore.hasEnabledAds}>
        <AdSlot position="sidebar" height="250px" />
    </div>
    <div class="px-2" class:hidden={!widgetLayoutStore.hasEnabledAds}>
        <AdSlot position="sidebar-2" height="250px" />
    </div>

    <!-- Slot: sidebar-left-bottom -->
    {#each getComponentsForSlot('sidebar-left-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}
</div>

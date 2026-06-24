<script lang="ts">
    import { untrack } from 'svelte';
    import { page } from '$app/stores';
    import {
        Accordion,
        AccordionItem,
        AccordionTrigger,
        AccordionContent
    } from '$lib/components/ui/accordion';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { handleBoardLinkClick } from '$lib/utils/board-nav.js';
    import { menuStore } from '$lib/stores/menu.svelte';

    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { getIcon } from '$lib/utils/icon-map';

    import UserWidget from './user-widget.svelte';
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import AdfitSlot from '$lib/components/ui/adfit-slot/adfit-slot.svelte';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';
    import DamoangBanner from '$lib/components/ui/damoang-banner/damoang-banner.svelte';
    import { CelebrationRolling } from '$lib/components/ui/celebration-rolling';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { boardFavoritesStore, slotLabel } from '$lib/stores/board-favorites.svelte';

    interface Props {
        compact?: boolean;
    }

    let { compact = false }: Props = $props();

    let isCollapsed = $state(false);

    // 메뉴 데이터는 SSR에서 초기화된 스토어에서 가져옴
    const menuData = $derived(menuStore.menus.filter((m) => m.show_in_sidebar !== false));

    // 빠른 바로가기: DB 메뉴 그룹(센티넬 URL)의 자식을 즐겨찾기 아래 2열 그리드로 렌더한다.
    // 라벨/URL/아이콘은 전부 DB(menus 테이블)에서 오며(하드코딩 없음), 관리자가 그룹의
    // 자식 메뉴를 추가/수정/정렬해 구성한다. 그룹이 없으면 아무것도 렌더하지 않는다.
    const SIDEBAR_QUICKLINKS_URL = '#sidebar-quicklinks';
    const quickLinksGroup = $derived(menuData.find((m) => m.url === SIDEBAR_QUICKLINKS_URL));
    const quickLinks = $derived(
        (quickLinksGroup?.children ?? []).filter((c) => c.show_in_sidebar !== false)
    );
    // 그룹 자체는 일반 nav 에서 제외(자식만 2열로 별도 렌더)
    const mainMenus = $derived(menuData.filter((m) => m.url !== SIDEBAR_QUICKLINKS_URL));
    const loading = $derived(menuStore.loading);
    const error = $derived(menuStore.error);

    // Current path tracking for active menu highlighting
    const currentPath = $derived($page.url.pathname);

    function isActive(url: string): boolean {
        // url='/' 는 그룹/부모 메뉴(더보기·안내 등)의 placeholder 라 실제 목적지가 아니다.
        // 홈(currentPath='/')에서 url='/' 메뉴가 전부 active 로 잡혀 "더보기"가 활성으로
        // 보이던 문제 방지 — 홈에서는 어떤 메뉴도 활성으로 표시하지 않는다.
        if (!url || url === '/') return false;
        return currentPath === url || currentPath.startsWith(url + '/');
    }

    // Writable state for accordion — allows both auto-open and manual interaction
    let accordionValue = $state<string | undefined>(undefined);

    // 2/3depth 그룹 접기/펼치기 상태
    let expandedGroups = $state<Set<number>>(new Set());

    function toggleSubGroup(id: number) {
        const next = new Set(expandedGroups);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        expandedGroups = next;
    }

    // 단일 트리 순회로 1depth 아코디언 + 2/3depth 서브그룹 동시 처리
    $effect(() => {
        let newAccordionValue: string | undefined = undefined;
        const autoExpand = new Set<number>();

        const traverse = (items: typeof menuData, depth: number) => {
            for (const item of items) {
                if (item.children?.length) {
                    const childActive = item.children.some(
                        (c) => isActive(c.url) || c.children?.some((gc) => isActive(gc.url))
                    );
                    if (depth === 0 && childActive) {
                        newAccordionValue = `item-${item.id}`;
                    }
                    if (depth >= 1 && childActive) {
                        autoExpand.add(item.id);
                    }
                    traverse(item.children, depth + 1);
                }
            }
        };

        traverse(menuData, 0);
        // accordionValue / expandedGroups 의 읽기·쓰기는 untrack 으로 격리한다.
        // 이 effect 의 의존성은 menuData + currentPath(isActive) 뿐이어야 한다.
        // 비교를 위해 accordionValue 를 그냥 읽으면 그것이 의존성이 되어, 사용자가
        // 1depth 아코디언을 직접 열 때 effect 가 재실행되며 활성 항목으로 되돌려
        // "펼치자마자 닫힘"이 발생한다 (#1589 회귀). expandedGroups 도 동일.
        untrack(() => {
            if (newAccordionValue && newAccordionValue !== accordionValue) {
                accordionValue = newAccordionValue;
            }
            // #12645: autoExpand 로 덮어쓰면 사용자가 수동으로 펼친/접은 상태가
            // 게시판 선택 시마다 리셋된다. 합집합 병합 + 변화 시에만 할당.
            if (autoExpand.size > 0) {
                const merged = new Set(expandedGroups);
                let changed = false;
                for (const id of autoExpand) {
                    if (!merged.has(id)) {
                        merged.add(id);
                        changed = true;
                    }
                }
                if (changed) expandedGroups = merged;
            }
        });
    });

    // 메뉴 필터링과 로딩은 menuStore에서 SSR로 처리됨
</script>

<div
    data-collapsed={isCollapsed}
    class={cn(
        'group flex flex-col pe-3 data-[collapsed=true]:py-2',
        compact ? 'gap-1 py-0 pe-1' : 'gap-4 py-2'
    )}
>
    <!-- Slot: sidebar-left-top -->
    {#each getComponentsForSlot('sidebar-left-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <div class={compact ? 'px-1' : 'px-2'}>
        <UserWidget {compact} />
    </div>

    <!-- 즐겨찾기 단축키 메뉴 (2열 그리드) -->
    {#if boardFavoritesStore.normalSlots.length > 0 || boardFavoritesStore.shiftSlots.length > 0}
        <div class={compact ? 'px-1' : 'px-2'}>
            <div class="text-muted-foreground mb-1.5 text-xs font-semibold">즐겨찾기</div>
            <!-- 일반 슬롯 (1-0): 2열 -->
            <div class="grid grid-cols-2 gap-0.5">
                {#each boardFavoritesStore.normalSlots as { slot, entry } (slot)}
                    {@const active = isActive(`/${entry.boardId}`)}
                    <a
                        href="/{entry.boardId}"
                        onclick={(e) => handleBoardLinkClick(e, entry.boardId, $page.url.pathname)}
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
                        class="text-muted-foreground hover:text-foreground flex cursor-pointer select-none items-center gap-1 px-2 py-1 text-xs transition-colors"
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
                                onclick={(e) =>
                                    handleBoardLinkClick(e, entry.boardId, $page.url.pathname)}
                                class={cn(
                                    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
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

    <!-- 빠른 바로가기 (DB 메뉴 그룹): 즐겨찾기 아래 2열 그리드 -->
    {#if quickLinks.length > 0}
        <div class={compact ? 'px-1' : 'px-2'}>
            <div class="grid grid-cols-2 gap-0.5">
                {#each quickLinks as link (link.id)}
                    {@const LinkIcon = getIcon(link.icon)}
                    {@const active = isActive(link.url)}
                    <a
                        href={link.url}
                        target={link.target || undefined}
                        class={cn(
                            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors',
                            active
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-accent text-muted-foreground'
                        )}
                    >
                        <LinkIcon class="h-3.5 w-3.5 shrink-0" />
                        <span class="truncate">{link.title}</span>
                    </a>
                {/each}
            </div>
        </div>
    {/if}

    <nav
        class={cn(
            'grid group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2',
            compact ? 'gap-0 px-1' : 'gap-1 px-2'
        )}
    >
        {#if loading}
            <div class="text-muted-foreground text-center text-sm">메뉴 로딩 중...</div>
        {:else if error}
            <div class="text-destructive text-center text-sm">{error}</div>
        {:else}
            <Accordion type="single" class="w-full" bind:value={accordionValue}>
                {#each mainMenus as menu (menu.id)}
                    {@const IconComponent = getIcon(menu.icon)}
                    {#if menu.children && menu.children.length > 0}
                        <!-- 하위 메뉴가 있는 경우 -->
                        <AccordionItem value={`item-${menu.id}`} class="border-none">
                            <AccordionTrigger
                                class={cn(
                                    'cursor-pointer',
                                    'hover:no-underline',
                                    compact && 'py-2.5',
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
                                                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-base font-medium transition-colors',
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
                                                        {#if child.children.length >= 4}
                                                            <!-- 3depth 그리드 레이아웃 (소모임 등) -->
                                                            <div
                                                                class="bg-muted/30 border-border/40 mt-1.5 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border"
                                                            >
                                                                {#each child.children as grandchild (grandchild.id)}
                                                                    {@const gcActive = isActive(
                                                                        grandchild.url
                                                                    )}
                                                                    <a
                                                                        href={grandchild.url}
                                                                        class={cn(
                                                                            'bg-background flex items-center justify-center px-1 py-2 text-center text-[11px] leading-tight transition-all duration-200 ease-out active:scale-[0.98]',
                                                                            gcActive
                                                                                ? 'bg-primary/10 text-primary font-semibold'
                                                                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                                                        )}
                                                                    >
                                                                        <span class="line-clamp-1"
                                                                            >{grandchild.title}</span
                                                                        >
                                                                    </a>
                                                                {/each}
                                                            </div>
                                                        {:else}
                                                            <!-- 3depth 리스트 레이아웃 (항목 적을 때) -->
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
                                                                            'h-8 w-full justify-start gap-2 text-sm',
                                                                            gcActive
                                                                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                                                : 'hover:bg-accent'
                                                                        )}
                                                                        href={grandchild.url}
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
                        <!-- 하위 메뉴가 없는 단독 메뉴 (accordion trigger 와 시각적 정렬 일치) -->
                        {@const active = isActive(menu.url)}
                        {@const external = menu.target === '_blank'}
                        <a
                            href={menu.url}
                            target={external ? '_blank' : undefined}
                            rel={external ? 'noopener noreferrer' : undefined}
                            class={cn(
                                'flex w-full items-center gap-2 rounded-md py-4 text-sm font-semibold transition-colors',
                                active
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 px-2'
                                    : 'hover:bg-accent hover:text-accent-foreground px-0',
                                isCollapsed && 'justify-center px-0'
                            )}
                        >
                            <IconComponent class="text-muted-foreground size-5" />
                            <span class={cn(isCollapsed && 'hidden')}>{menu.title}</span>
                        </a>
                    {/if}
                {/each}
            </Accordion>
        {/if}
    </nav>

    <!-- 사이드바 메뉴 아래 광고 -->
    <div class={compact ? 'space-y-2 px-1' : 'space-y-2 px-2'}>
        {#if !compact}
            <!-- 데스크톱: 메뉴 ↔ (카카오)광고 사이 후원하기 1줄 카드 (benecent). 광고 on/off 무관 항상 노출. -->
            <a
                href="https://damoang.benecent.org"
                target="_blank"
                rel="noopener noreferrer"
                class="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            >
                <span>☆ 다모앙 후원하기</span>
                <span aria-hidden="true" class="leading-none">→</span>
            </a>
        {/if}
        <div class:hidden={!widgetLayoutStore.hasEnabledAds}>
            {#if compact}{:else}
                <AdSlot position="sidebar" height="250px" slotKey="sidebar-main" />
                <!-- 애드핏 심사용 (GAM 아래 배치) -->
                <div class="mt-2">
                    <AdfitSlot
                        unit={{ unitId: 'DAN-LXOsjqjRz52xL3Ti', width: 160, height: 600 }}
                        id="sidebar-adfit-review"
                    />
                </div>
            {/if}
        </div>
        {#if compact}
            <!-- 드로워: 네모배너 (다모앙 광고 → GAM 폴백) -->
            <div class:hidden={!widgetLayoutStore.hasEnabledAds}>
                <DamoangBanner
                    position="sidebar"
                    height="100px"
                    showCelebration={false}
                    gamPosition="sidebar-drawer"
                    class="drawer-sidebar-banner"
                />
            </div>
            <!-- 드로워: 이미지텍스트 배너 -->
            <div>
                <div class="mb-1 flex items-center justify-between">
                    <span class="text-xs font-medium text-slate-500">AD</span>
                </div>
                <ImageTextBanner position="side-image-text-banner" />
            </div>
            <!-- 드로워: 마음메시지 -->
            <CelebrationRolling />
            <!-- 마음메시지 아래: 후원하기 1줄 카드 (benecent). 강조색으로 눈에 띄게, 1줄로 작게. -->
            <a
                href="https://damoang.benecent.org"
                target="_blank"
                rel="noopener noreferrer"
                class="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            >
                <span>☆ 다모앙 후원하기</span>
                <span aria-hidden="true" class="leading-none">→</span>
            </a>
            <!-- 마음메시지 바로 아래: 벽돌한장 · 광고 제거 inline -->
            <div class="text-muted-foreground flex items-center justify-center gap-3 px-2 text-xs">
                <a href="/brickang" class="hover:text-primary underline-offset-2 hover:underline">
                    벽돌한장
                </a>
                <span class="opacity-50">·</span>
                <a href="/ad-free" class="hover:text-primary underline-offset-2 hover:underline">
                    광고 제거
                </a>
            </div>
        {:else}
            <!-- Slot: sidebar-left-bottom -->
            {#each getComponentsForSlot('sidebar-left-bottom') as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}
        {/if}
    </div>
</div>

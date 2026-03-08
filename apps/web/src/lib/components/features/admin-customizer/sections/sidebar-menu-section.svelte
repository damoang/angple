<script lang="ts">
    import { menuStore as adminMenuStore } from '$lib/stores/admin-menu-store.svelte';
    import { menuStore } from '$lib/stores/menu.svelte';
    import type { Menu } from '$lib/types/admin-menu';
    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import { dndzone } from 'svelte-dnd-action';

    // 사이드바에 표시되는 루트 메뉴
    const sidebarMenus = $derived(
        adminMenuStore.menus
            .filter((m) => m.show_in_sidebar)
            .sort((a, b) => a.order_num - b.order_num)
    );

    let dndItems = $derived(sidebarMenus.map((m) => ({ ...m, id: m.id })));
    let expandedIds = $state(new Set<number>());

    function toggleExpand(id: number) {
        const next = new Set(expandedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        expandedIds = next;
    }

    function handleDndConsider(e: CustomEvent<{ items: Menu[] }>) {
        dndItems = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<{ items: Menu[] }>) {
        dndItems = e.detail.items;
        const reordered = adminMenuStore.menus.map((m) => {
            const idx = dndItems.findIndex((d) => d.id === m.id);
            if (idx >= 0) {
                return { ...m, order_num: idx };
            }
            return m;
        });
        adminMenuStore.updateMenuOrder(reordered);
    }

    async function toggleActive(menu: Menu) {
        await adminMenuStore.toggleMenuProperty(menu.id, 'is_active');
        await adminMenuStore.loadMenus();
        menuStore.initFromServer(adminMenuStore.menus);
    }

    async function toggleSidebar(menu: Menu) {
        await adminMenuStore.toggleMenuProperty(menu.id, 'show_in_sidebar');
        await adminMenuStore.loadMenus();
        menuStore.initFromServer(adminMenuStore.menus);
    }

    // 사이드바에 표시되지 않는 메뉴 (추가 후보)
    const availableMenus = $derived(
        adminMenuStore.menus.filter((m) => !m.show_in_sidebar && m.depth === 0)
    );
</script>

<div class="flex flex-col gap-4 p-4">
    <div>
        <h3 class="mb-1 text-sm font-medium">사이드바 메뉴</h3>
        <p class="text-muted-foreground mb-3 text-xs">
            드래그하여 순서를 변경하고, 토글로 활성/비활성화하세요.
        </p>

        {#if dndItems.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">사이드바 메뉴가 없습니다.</p>
        {:else}
            <div
                use:dndzone={{ items: dndItems, flipDurationMs: 200, type: 'sidebar-menus' }}
                onconsider={handleDndConsider}
                onfinalize={handleDndFinalize}
                class="flex flex-col gap-1"
            >
                {#each dndItems as menu (menu.id)}
                    <div class="border-border rounded-md border">
                        <div class="flex items-center gap-2 px-3 py-2">
                            <GripVertical
                                class="text-muted-foreground h-4 w-4 shrink-0 cursor-grab"
                            />

                            {#if menu.children && menu.children.length > 0}
                                <button
                                    type="button"
                                    onclick={() => toggleExpand(menu.id)}
                                    class="hover:bg-muted rounded p-0.5"
                                >
                                    {#if expandedIds.has(menu.id)}
                                        <ChevronDown class="h-3.5 w-3.5" />
                                    {:else}
                                        <ChevronRight class="h-3.5 w-3.5" />
                                    {/if}
                                </button>
                            {:else}
                                <div class="w-[18px]"></div>
                            {/if}

                            <span
                                class="flex-1 truncate text-sm {menu.is_active
                                    ? ''
                                    : 'text-muted-foreground line-through'}"
                            >
                                {menu.title}
                            </span>

                            <button
                                type="button"
                                onclick={() => toggleActive(menu)}
                                class="rounded px-1.5 py-0.5 text-xs transition-colors {menu.is_active
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'}"
                            >
                                {menu.is_active ? 'ON' : 'OFF'}
                            </button>

                            <button
                                type="button"
                                onclick={() => toggleSidebar(menu)}
                                class="text-muted-foreground hover:text-destructive text-xs"
                                title="사이드바에서 제거"
                            >
                                제거
                            </button>
                        </div>

                        <!-- 하위 메뉴 표시 -->
                        {#if expandedIds.has(menu.id) && menu.children && menu.children.length > 0}
                            <div class="border-border border-t px-3 py-1">
                                {#each menu.children as child (child.id)}
                                    <div class="flex items-center gap-2 py-1.5 pl-6">
                                        <span
                                            class="flex-1 truncate text-xs {child.is_active
                                                ? ''
                                                : 'text-muted-foreground line-through'}"
                                        >
                                            {child.title}
                                        </span>
                                        <button
                                            type="button"
                                            onclick={() => toggleActive(child)}
                                            class="rounded px-1.5 py-0.5 text-[10px] transition-colors {child.is_active
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-muted text-muted-foreground'}"
                                        >
                                            {child.is_active ? 'ON' : 'OFF'}
                                        </button>
                                    </div>

                                    <!-- depth 3 -->
                                    {#if expandedIds.has(menu.id) && child.children && child.children.length > 0}
                                        {#each child.children as grandchild (grandchild.id)}
                                            <div class="flex items-center gap-2 py-1 pl-12">
                                                <span
                                                    class="flex-1 truncate text-xs {grandchild.is_active
                                                        ? 'text-muted-foreground'
                                                        : 'text-muted-foreground/50 line-through'}"
                                                >
                                                    {grandchild.title}
                                                </span>
                                                <button
                                                    type="button"
                                                    onclick={() => toggleActive(grandchild)}
                                                    class="rounded px-1 py-0.5 text-[10px] transition-colors {grandchild.is_active
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'bg-muted text-muted-foreground'}"
                                                >
                                                    {grandchild.is_active ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                        {/each}
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    {#if availableMenus.length > 0}
        <div>
            <h3 class="mb-2 text-sm font-medium">메뉴 추가</h3>
            <div class="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {#each availableMenus as menu (menu.id)}
                    <button
                        type="button"
                        onclick={() => toggleSidebar(menu)}
                        class="hover:bg-muted flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors"
                    >
                        <span class="truncate">{menu.title}</span>
                        <span class="text-primary text-xs">+ 추가</span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>

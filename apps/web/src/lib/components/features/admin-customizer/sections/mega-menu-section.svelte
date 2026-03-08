<script lang="ts">
    import { menuStore as adminMenuStore } from '$lib/stores/admin-menu-store.svelte';
    import { menuStore } from '$lib/stores/menu.svelte';
    import type { Menu } from '$lib/types/admin-menu';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';

    // 하위 메뉴가 있는 루트 메뉴 (펼침메뉴 후보)
    const parentMenus = $derived(
        adminMenuStore.menus.filter((m) => m.children && m.children.length > 0 && m.is_active)
    );

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

    async function toggleActive(menu: Menu) {
        await adminMenuStore.toggleMenuProperty(menu.id, 'is_active');
        await adminMenuStore.loadMenus();
        menuStore.initFromServer(adminMenuStore.menus);
    }

    async function toggleHeader(menu: Menu) {
        await adminMenuStore.toggleMenuProperty(menu.id, 'show_in_header');
        await adminMenuStore.loadMenus();
        menuStore.initFromServer(adminMenuStore.menus);
    }
</script>

<div class="flex flex-col gap-4 p-4">
    <div>
        <h3 class="mb-1 text-sm font-medium">펼침 메뉴 (Mega Menu)</h3>
        <p class="text-muted-foreground mb-3 text-xs">
            하위 메뉴가 있는 항목을 관리합니다. 헤더에 노출되면 펼침메뉴로 표시됩니다.
        </p>

        {#if parentMenus.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">
                하위 메뉴가 있는 항목이 없습니다.
            </p>
        {:else}
            <div class="flex flex-col gap-2">
                {#each parentMenus as menu (menu.id)}
                    <div class="border-border rounded-md border">
                        <!-- 부모 메뉴 -->
                        <div class="flex items-center gap-2 px-3 py-2">
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

                            <span class="flex-1 truncate text-sm font-medium">{menu.title}</span>

                            <span class="text-muted-foreground text-xs">
                                {menu.children?.length ?? 0}개
                            </span>

                            <button
                                type="button"
                                onclick={() => toggleHeader(menu)}
                                class="rounded px-1.5 py-0.5 text-xs transition-colors {menu.show_in_header
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'}"
                                title={menu.show_in_header ? '헤더에서 숨기기' : '헤더에 표시'}
                            >
                                {menu.show_in_header ? '헤더' : '숨김'}
                            </button>
                        </div>

                        <!-- 하위 메뉴 리스트 -->
                        {#if expandedIds.has(menu.id) && menu.children}
                            <div class="border-border border-t px-3 py-1">
                                {#each menu.children as child (child.id)}
                                    <div class="flex items-center gap-2 py-1.5 pl-4">
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
                                    {#if child.children && child.children.length > 0}
                                        {#each child.children as grandchild (grandchild.id)}
                                            <div class="flex items-center gap-2 py-1 pl-8">
                                                <span
                                                    class="flex-1 truncate text-[11px] {grandchild.is_active
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
</div>

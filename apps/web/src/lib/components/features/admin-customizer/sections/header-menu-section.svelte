<script lang="ts">
    import { menuStore as adminMenuStore } from '$lib/stores/admin-menu-store.svelte';
    import { customizerStore } from '$lib/stores/admin-customizer.svelte';
    import type { Menu } from '$lib/types/admin-menu';
    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import { dndzone } from 'svelte-dnd-action';

    // 상단 메뉴에 표시되는 항목만 필터
    const headerMenus = $derived(
        adminMenuStore.menus
            .filter((m) => m.show_in_header)
            .sort((a, b) => a.order_num - b.order_num)
    );

    // 상단 메뉴에 표시되지 않는 항목 (추가 후보)
    const availableMenus = $derived(
        collectAllMenus(adminMenuStore.menus).filter((m) => !m.show_in_header && m.is_active)
    );

    function collectAllMenus(menus: Menu[]): Menu[] {
        const result: Menu[] = [];
        for (const m of menus) {
            result.push(m);
            if (m.children) {
                result.push(...collectAllMenus(m.children));
            }
        }
        return result;
    }

    // DnD용 아이템 (id 필수)
    let dndItems = $derived(headerMenus.map((m) => ({ ...m, id: m.id })));

    function handleDndConsider(e: CustomEvent<{ items: Menu[] }>) {
        dndItems = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<{ items: Menu[] }>) {
        dndItems = e.detail.items;
        // 순서 변경을 admin store에 반영
        const reordered = adminMenuStore.menus.map((m) => {
            const idx = dndItems.findIndex((d) => d.id === m.id);
            if (idx >= 0) {
                return { ...m, order_num: idx };
            }
            return m;
        });
        adminMenuStore.updateMenuOrder(reordered);
    }

    async function toggleHeader(menu: Menu) {
        await adminMenuStore.toggleMenuProperty(menu.id, 'show_in_header');
        // 프론트 메뉴 스토어도 갱신
        await adminMenuStore.loadMenus();
        customizerStore.refreshFrontMenus();
    }

    async function addToHeader(menuId: number) {
        await adminMenuStore.toggleMenuProperty(menuId, 'show_in_header');
        await adminMenuStore.loadMenus();
        customizerStore.refreshFrontMenus();
    }
</script>

<div class="flex flex-col gap-4 p-4">
    <div>
        <h3 class="mb-1 text-sm font-medium">상단 메뉴 순서</h3>
        <p class="text-muted-foreground mb-3 text-xs">드래그하여 순서를 변경하세요.</p>

        {#if dndItems.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">상단 메뉴가 없습니다.</p>
        {:else}
            <div
                use:dndzone={{ items: dndItems, flipDurationMs: 200, type: 'header-menus' }}
                onconsider={handleDndConsider}
                onfinalize={handleDndFinalize}
                class="flex flex-col gap-1"
            >
                {#each dndItems as menu (menu.id)}
                    <div
                        class="bg-background border-border flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                        <GripVertical class="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
                        <span class="flex-1 truncate text-sm">{menu.title}</span>
                        <button
                            type="button"
                            onclick={() => toggleHeader(menu)}
                            class="text-muted-foreground hover:text-destructive text-xs"
                            title="상단에서 제거"
                        >
                            제거
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    {#if availableMenus.length > 0}
        <div>
            <h3 class="mb-2 text-sm font-medium">메뉴 추가</h3>
            <div class="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {#each availableMenus as menu (menu.id)}
                    <button
                        type="button"
                        onclick={() => addToHeader(menu.id)}
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

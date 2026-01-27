<script lang="ts">
    import type { Menu } from '$lib/types/menu';
    import MenuItemRow from './menu-item-row.svelte';
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';

    interface Props {
        menus: Menu[];
        depth?: number;
        onEdit: (menuId: number) => void;
        onAddChild: (parentId: number | null) => void;
        onReorder: (newMenus: Menu[]) => void;
    }

    let { menus, depth = 0, onEdit, onAddChild, onReorder }: Props = $props();

    // 드래그앤드롭 설정
    const flipDurationMs = 200;

    function handleDndConsider(e: CustomEvent<DndEvent<Menu>>) {
        menus = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<Menu>>) {
        menus = e.detail.items;
        onReorder(menus);
    }

    function handleChildReorder(parentIndex: number, newChildren: Menu[]) {
        menus[parentIndex].children = newChildren;
        onReorder(menus);
    }
</script>

<div
    class="space-y-1"
    use:dndzone={{
        items: menus,
        flipDurationMs,
        dropTargetStyle: { outline: '2px dashed #3b82f6', outlineOffset: '2px' }
    }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
>
    {#each menus as menu, index (menu.id)}
        <div animate:flip={{ duration: flipDurationMs }}>
            <MenuItemRow
                {menu}
                {depth}
                {onEdit}
                {onAddChild}
            />

            {#if menu.children && menu.children.length > 0}
                <div class="ml-6 mt-1 border-l-2 border-border pl-2">
                    <svelte:self
                        menus={menu.children}
                        depth={depth + 1}
                        {onEdit}
                        {onAddChild}
                        onReorder={(newChildren) => handleChildReorder(index, newChildren)}
                    />
                </div>
            {/if}
        </div>
    {/each}
</div>

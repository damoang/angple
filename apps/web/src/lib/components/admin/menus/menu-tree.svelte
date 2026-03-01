<script lang="ts">
    import type { Menu } from '$lib/types/admin-menu';
    import MenuItemRow from './menu-item-row.svelte';
    import MenuTree from './menu-tree.svelte';
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { Button } from '$lib/components/ui/button';
    import { ChevronRight, ChevronDown } from '@lucide/svelte/icons';

    interface Props {
        menus: Menu[];
        depth?: number;
        onEdit: (menuId: number) => void;
        onAddChild: (parentId: number | null) => void;
        onReorder: (newMenus: Menu[]) => void;
        collapsedIds?: Set<number>;
        onToggleCollapse?: (id: number) => void;
    }

    let {
        menus,
        depth = 0,
        onEdit,
        onAddChild,
        onReorder,
        collapsedIds = $bindable(new Set<number>()),
        onToggleCollapse
    }: Props = $props();

    const flipDurationMs = 200;

    function toggleCollapse(id: number) {
        if (onToggleCollapse) {
            onToggleCollapse(id);
        } else {
            if (collapsedIds.has(id)) {
                collapsedIds.delete(id);
            } else {
                collapsedIds.add(id);
            }
            collapsedIds = new Set(collapsedIds);
        }
    }

    function isCollapsed(id: number): boolean {
        return collapsedIds.has(id);
    }

    function hasChildren(menu: Menu): boolean {
        return menu.children !== undefined && menu.children.length > 0;
    }

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
            <div class="flex items-center gap-1">
                {#if hasChildren(menu)}
                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6 shrink-0"
                        onclick={() => toggleCollapse(menu.id)}
                    >
                        {#if isCollapsed(menu.id)}
                            <ChevronRight class="h-4 w-4" />
                        {:else}
                            <ChevronDown class="h-4 w-4" />
                        {/if}
                    </Button>
                {:else}
                    <div class="w-7 shrink-0"></div>
                {/if}
                <div class="flex-1">
                    <MenuItemRow {menu} {depth} {onEdit} {onAddChild} />
                </div>
            </div>

            {#if hasChildren(menu) && !isCollapsed(menu.id)}
                <div class="border-border ml-6 mt-1 border-l-2 pl-2">
                    <MenuTree
                        menus={menu.children ?? []}
                        depth={depth + 1}
                        {onEdit}
                        {onAddChild}
                        onReorder={(newChildren: Menu[]) => handleChildReorder(index, newChildren)}
                        {collapsedIds}
                        {onToggleCollapse}
                    />
                </div>
            {/if}
        </div>
    {/each}
</div>

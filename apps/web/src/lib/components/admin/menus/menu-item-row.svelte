<script lang="ts">
    import type { Menu } from '$lib/types/admin-menu';
    import { menuStore } from '$lib/stores/admin-menu-store.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import {
        GripVertical,
        Pencil,
        Trash2,
        Plus,
        MoreHorizontal,
        Eye,
        EyeOff,
        PanelTop,
        PanelLeft,
        ExternalLink,
        Link
    } from '@lucide/svelte/icons';

    interface Props {
        menu: Menu;
        depth: number;
        onEdit: (menuId: number) => void;
        onAddChild: (parentId: number | null) => void;
    }

    let { menu, depth, onEdit, onAddChild }: Props = $props();

    async function handleDelete() {
        if (confirm(`"${menu.title}" 메뉴를 삭제하시겠습니까? 하위 메뉴도 함께 삭제됩니다.`)) {
            await menuStore.deleteMenu(menu.id);
        }
    }

    async function toggleHeader() {
        await menuStore.toggleMenuProperty(menu.id, 'show_in_header');
    }

    async function toggleSidebar() {
        await menuStore.toggleMenuProperty(menu.id, 'show_in_sidebar');
    }

    async function toggleActive() {
        await menuStore.toggleMenuProperty(menu.id, 'is_active');
    }
</script>

<div
    class="bg-card hover:bg-accent/50 group flex items-center gap-2 rounded-lg border p-3 transition-colors {!menu.is_active
        ? 'opacity-50'
        : ''}"
>
    <div class="text-muted-foreground hover:text-foreground cursor-grab">
        <GripVertical class="h-5 w-5" />
    </div>

    <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
            <span class="truncate font-medium">{menu.title}</span>
            {#if menu.icon}
                <Badge variant="outline" class="text-xs">{menu.icon}</Badge>
            {/if}
            {#if menu.target === '_blank'}
                <ExternalLink class="text-muted-foreground h-3 w-3" />
            {/if}
        </div>
        <div class="text-muted-foreground flex items-center gap-2 text-sm">
            <Link class="h-3 w-3" />
            <span class="truncate">{menu.url}</span>
        </div>
    </div>

    <div class="flex items-center gap-1">
        {#if menu.show_in_header}
            <Badge variant="secondary" class="text-xs">
                <PanelTop class="mr-1 h-3 w-3" />
                헤더
            </Badge>
        {/if}
        {#if menu.show_in_sidebar}
            <Badge variant="secondary" class="text-xs">
                <PanelLeft class="mr-1 h-3 w-3" />
                사이드바
            </Badge>
        {/if}
        {#if !menu.is_active}
            <Badge variant="destructive" class="text-xs">
                <EyeOff class="mr-1 h-3 w-3" />
                비활성
            </Badge>
        {/if}
    </div>

    <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => onEdit(menu.id)}>
            <Pencil class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => onAddChild(menu.id)}>
            <Plus class="h-4 w-4" />
        </Button>

        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                {#snippet child({ props })}
                    <Button variant="ghost" size="icon" class="h-8 w-8" {...props}>
                        <MoreHorizontal class="h-4 w-4" />
                    </Button>
                {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Item onclick={toggleHeader}>
                    <PanelTop class="mr-2 h-4 w-4" />
                    {menu.show_in_header ? '헤더에서 숨기기' : '헤더에 표시'}
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={toggleSidebar}>
                    <PanelLeft class="mr-2 h-4 w-4" />
                    {menu.show_in_sidebar ? '사이드바에서 숨기기' : '사이드바에 표시'}
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={toggleActive}>
                    {#if menu.is_active}
                        <EyeOff class="mr-2 h-4 w-4" />
                        비활성화
                    {:else}
                        <Eye class="mr-2 h-4 w-4" />
                        활성화
                    {/if}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onclick={handleDelete} class="text-destructive">
                    <Trash2 class="mr-2 h-4 w-4" />
                    삭제
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>
</div>

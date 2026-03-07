<script lang="ts">
    import type { Menu } from '$lib/types/admin-menu';
    import { menuStore } from '$lib/stores/admin-menu-store.svelte';
    import { Button } from '$lib/components/ui/button';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import {
        GripVertical,
        Pencil,
        Trash2,
        Plus,
        MoreHorizontal,
        ExternalLink,
        Link
    } from '@lucide/svelte/icons';
    import PanelTop from '@lucide/svelte/icons/panel-top';
    import PanelLeft from '@lucide/svelte/icons/panel-left';
    import Eye from '@lucide/svelte/icons/eye';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import { getIcon } from '$lib/utils/icon-map';

    interface Props {
        menu: Menu;
        depth: number;
        onEdit: (menuId: number) => void;
        onAddChild: (parentId: number | null) => void;
    }

    let { menu, depth, onEdit, onAddChild }: Props = $props();

    const MenuIcon = $derived(getIcon(menu.icon));

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
            <MenuIcon class="text-muted-foreground h-4 w-4 shrink-0" />
            <span class="truncate font-medium">{menu.title}</span>
            {#if menu.target === '_blank'}
                <ExternalLink class="text-muted-foreground h-3 w-3" />
            {/if}
        </div>
        <div class="text-muted-foreground flex items-center gap-2 text-sm">
            <Link class="h-3 w-3" />
            <span class="truncate">{menu.url}</span>
        </div>
    </div>

    <!-- 인라인 토글 버튼 -->
    <div class="flex items-center gap-1">
        <button
            type="button"
            onclick={toggleHeader}
            class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors {menu.show_in_header
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent border-transparent'}"
            title={menu.show_in_header ? '헤더에서 숨기기' : '헤더에 표시'}
        >
            <PanelTop class="h-3 w-3" />
            헤더
        </button>
        <button
            type="button"
            onclick={toggleSidebar}
            class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors {menu.show_in_sidebar
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent border-transparent'}"
            title={menu.show_in_sidebar ? '사이드바에서 숨기기' : '사이드바에 표시'}
        >
            <PanelLeft class="h-3 w-3" />
            사이드바
        </button>
        <button
            type="button"
            onclick={toggleActive}
            class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors {menu.is_active
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-destructive/30 bg-destructive/10 text-destructive'}"
            title={menu.is_active ? '비활성화' : '활성화'}
        >
            {#if menu.is_active}
                <Eye class="h-3 w-3" />
            {:else}
                <EyeOff class="h-3 w-3" />
            {/if}
            {menu.is_active ? '활성' : '비활성'}
        </button>
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
                <DropdownMenu.Item onclick={handleDelete} class="text-destructive">
                    <Trash2 class="mr-2 h-4 w-4" />
                    삭제
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>
</div>

<script lang="ts">
    import { menuStore } from '$lib/stores/admin-menu-store.svelte';
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card';
    import {
        Loader2,
        Plus,
        Save,
        RotateCcw,
        Menu as MenuIcon,
        ChevronsDownUp,
        ChevronsUpDown
    } from '@lucide/svelte/icons';
    import type { Menu } from '$lib/types/admin-menu';
    import MenuTree from '$lib/components/admin/menus/menu-tree.svelte';
    import AddMenuDialog from '$lib/components/admin/menus/add-menu-dialog.svelte';
    import EditMenuDialog from '$lib/components/admin/menus/edit-menu-dialog.svelte';

    // SSR 데이터
    let { data } = $props();

    let showAddDialog = $state(false);
    let showEditDialog = $state(false);
    let parentIdForAdd = $state<number | null>(null);

    // 접기/펼치기 상태 (기본: 모두 접힘)
    let collapsedIds = $state<Set<number>>(new Set());
    let allCollapsed = $derived.by(() => {
        const parentIds = collectParentIds(menuStore.menus);
        return (
            parentIds.size > 0 &&
            parentIds.size === collapsedIds.size &&
            [...parentIds].every((id) => collapsedIds.has(id))
        );
    });

    function collectParentIds(menus: Menu[]): Set<number> {
        const ids = new Set<number>();
        for (const m of menus) {
            if (m.children && m.children.length > 0) {
                ids.add(m.id);
                for (const id of collectParentIds(m.children)) ids.add(id);
            }
        }
        return ids;
    }

    function collapseAll() {
        collapsedIds = collectParentIds(menuStore.menus);
    }

    function expandAll() {
        collapsedIds = new Set();
    }

    // SSR 데이터로 스토어 초기화 + 기본 접힘
    $effect(() => {
        if (data.menus && data.menus.length > 0) {
            menuStore.initFromServer(data.menus);
            collapsedIds = collectParentIds(data.menus);
        }
    });

    function handleAddMenu(parentId: number | null = null) {
        parentIdForAdd = parentId;
        showAddDialog = true;
    }

    function handleEditMenu(menuId: number) {
        menuStore.selectMenu(menuId);
        showEditDialog = true;
    }

    function handleCloseEditDialog() {
        showEditDialog = false;
        menuStore.selectMenu(null);
    }

    async function handleSaveReorder() {
        await menuStore.saveReorder();
    }
    function handleDiscardChanges() {
        menuStore.discardChanges();
    }
</script>

<svelte:head>
    <title>메뉴 관리 - 관리자</title>
</svelte:head>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-3xl font-bold tracking-tight">메뉴 관리</h2>
            <p class="text-muted-foreground">
                사이트 메뉴를 추가, 수정, 삭제하고 순서를 변경합니다.
            </p>
        </div>
        <div class="flex items-center gap-2">
            {#if menuStore.hasChanges}
                <Button
                    variant="outline"
                    onclick={handleDiscardChanges}
                    disabled={menuStore.isSaving}
                >
                    <RotateCcw class="mr-2 h-4 w-4" />
                    변경 취소
                </Button>
                <Button onclick={handleSaveReorder} disabled={menuStore.isSaving}>
                    {#if menuStore.isSaving}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    {:else}
                        <Save class="mr-2 h-4 w-4" />
                    {/if}
                    순서 저장
                </Button>
            {/if}
            <Button onclick={() => handleAddMenu(null)}>
                <Plus class="mr-2 h-4 w-4" />
                메뉴 추가
            </Button>
        </div>
    </div>

    <Card>
        <CardHeader>
            <div class="flex items-center justify-between">
                <div>
                    <CardTitle class="flex items-center gap-2">
                        <MenuIcon class="h-5 w-5" />
                        메뉴 트리
                    </CardTitle>
                    <CardDescription
                        >드래그하여 메뉴 순서와 계층을 변경할 수 있습니다.</CardDescription
                    >
                </div>
                {#if menuStore.menus.length > 0}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={allCollapsed ? expandAll : collapseAll}
                    >
                        {#if allCollapsed}
                            <ChevronsUpDown class="mr-1.5 h-4 w-4" />
                            모두 펼치기
                        {:else}
                            <ChevronsDownUp class="mr-1.5 h-4 w-4" />
                            모두 접기
                        {/if}
                    </Button>
                {/if}
            </div>
        </CardHeader>
        <CardContent>
            {#if menuStore.isLoading}
                <div class="flex items-center justify-center py-12">
                    <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
            {:else if menuStore.menus.length === 0}
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <MenuIcon class="text-muted-foreground mb-4 h-12 w-12" />
                    <h3 class="text-lg font-semibold">메뉴가 없습니다</h3>
                    <p class="text-muted-foreground mb-4">
                        새 메뉴를 추가하여 사이트 네비게이션을 구성하세요.
                    </p>
                    <Button onclick={() => handleAddMenu(null)}>
                        <Plus class="mr-2 h-4 w-4" />
                        첫 메뉴 추가
                    </Button>
                </div>
            {:else}
                <div class="max-h-[70vh] overflow-y-auto pr-1">
                    <MenuTree
                        menus={menuStore.menus}
                        onEdit={handleEditMenu}
                        onAddChild={handleAddMenu}
                        onReorder={(newMenus) => menuStore.updateMenuOrder(newMenus)}
                        bind:collapsedIds
                    />
                </div>
            {/if}
        </CardContent>
    </Card>
</div>

<AddMenuDialog
    bind:open={showAddDialog}
    parentId={parentIdForAdd}
    onSuccess={() => {
        showAddDialog = false;
        parentIdForAdd = null;
    }}
/>
<EditMenuDialog
    bind:open={showEditDialog}
    menu={menuStore.selectedMenu}
    onClose={handleCloseEditDialog}
/>

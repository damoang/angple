<script lang="ts">
    /**
     * 관리자 게시판 그룹 관리 페이지
     * 게시판 그룹 CRUD + 순서 변경
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import FolderOpen from '@lucide/svelte/icons/folder-open';
    import Plus from '@lucide/svelte/icons/plus';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import ChevronUp from '@lucide/svelte/icons/chevron-up';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';

    interface BoardGroup {
        id: string;
        name: string;
        description?: string;
        sort_order: number;
        is_visible: boolean;
        boards?: { board_id: string; subject: string }[];
    }

    const API_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:5173';

    let groups = $state<BoardGroup[]>([]);
    let loading = $state(true);

    // 폼 상태
    let showDialog = $state(false);
    let editingGroup = $state<BoardGroup | null>(null);
    let formId = $state('');
    let formName = $state('');
    let formDescription = $state('');
    let formVisible = $state(true);
    let saving = $state(false);

    async function fetchGroups() {
        loading = true;
        try {
            const res = await fetch(`${API_BASE}/api/board-groups`);
            if (res.ok) {
                const data = await res.json();
                groups = data.data ?? data ?? [];
            } else {
                groups = [];
            }
        } catch {
            groups = [];
        } finally {
            loading = false;
        }
    }

    function openCreateDialog() {
        editingGroup = null;
        formId = '';
        formName = '';
        formDescription = '';
        formVisible = true;
        showDialog = true;
    }

    function openEditDialog(group: BoardGroup) {
        editingGroup = group;
        formId = group.id;
        formName = group.name;
        formDescription = group.description ?? '';
        formVisible = group.is_visible;
        showDialog = true;
    }

    async function handleSave() {
        if (!formName.trim()) return;
        saving = true;
        try {
            if (editingGroup) {
                await fetch(`${API_BASE}/api/admin/board-groups/${editingGroup.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formName,
                        description: formDescription,
                        is_visible: formVisible
                    })
                });
            } else {
                await fetch(`${API_BASE}/api/admin/board-groups`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: formId,
                        name: formName,
                        description: formDescription,
                        is_visible: formVisible
                    })
                });
            }
            showDialog = false;
            await fetchGroups();
        } catch (err) {
            console.error('저장 실패:', err);
        } finally {
            saving = false;
        }
    }

    async function deleteGroup(group: BoardGroup) {
        if (!confirm(`"${group.name}" 그룹을 삭제하시겠습니까?`)) return;
        try {
            await fetch(`${API_BASE}/api/admin/board-groups/${group.id}`, {
                method: 'DELETE'
            });
            await fetchGroups();
        } catch (err) {
            console.error('삭제 실패:', err);
        }
    }

    async function moveGroup(index: number, direction: 'up' | 'down') {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= groups.length) return;

        const reordered = [...groups];
        [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
        groups = reordered;

        try {
            await fetch(`${API_BASE}/api/admin/board-groups/reorder`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_ids: reordered.map((g) => g.id) })
            });
        } catch (err) {
            console.error('순서 변경 실패:', err);
            await fetchGroups();
        }
    }

    onMount(() => {
        fetchGroups();
    });
</script>

<svelte:head>
    <title>게시판 그룹 관리 - Angple Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">게시판 그룹 관리</h1>
            <p class="text-muted-foreground text-sm">
                게시판을 그룹으로 묶어 사이드바에 표시합니다.
            </p>
        </div>
        <Button onclick={openCreateDialog}>
            <Plus class="mr-1.5 h-4 w-4" />
            그룹 추가
        </Button>
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <p class="text-muted-foreground text-sm">로딩 중...</p>
        </div>
    {:else if groups.length === 0}
        <Card.Root>
            <Card.Content class="flex flex-col items-center justify-center py-12">
                <FolderOpen class="text-muted-foreground mb-4 h-12 w-12" />
                <p class="text-muted-foreground mb-4">게시판 그룹이 없습니다.</p>
                <Button onclick={openCreateDialog}>
                    <Plus class="mr-1.5 h-4 w-4" />
                    첫 그룹 만들기
                </Button>
            </Card.Content>
        </Card.Root>
    {:else}
        <div class="space-y-3">
            {#each groups as group, i (group.id)}
                <Card.Root>
                    <Card.Content class="flex items-center gap-4 p-4">
                        <div class="text-muted-foreground flex flex-col gap-0.5">
                            <button
                                onclick={() => moveGroup(i, 'up')}
                                disabled={i === 0}
                                class="hover:text-foreground disabled:opacity-30"
                                aria-label="위로 이동"
                            >
                                <ChevronUp class="h-4 w-4" />
                            </button>
                            <GripVertical class="h-4 w-4 opacity-30" />
                            <button
                                onclick={() => moveGroup(i, 'down')}
                                disabled={i === groups.length - 1}
                                class="hover:text-foreground disabled:opacity-30"
                                aria-label="아래로 이동"
                            >
                                <ChevronDown class="h-4 w-4" />
                            </button>
                        </div>

                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <FolderOpen class="h-4 w-4 shrink-0" />
                                <span class="font-medium">{group.name}</span>
                                {#if !group.is_visible}
                                    <Badge variant="outline" class="text-xs">숨김</Badge>
                                {/if}
                                {#if group.boards?.length}
                                    <Badge variant="secondary" class="text-xs">
                                        게시판 {group.boards.length}개
                                    </Badge>
                                {/if}
                            </div>
                            {#if group.description}
                                <p class="text-muted-foreground mt-0.5 text-sm">
                                    {group.description}
                                </p>
                            {/if}
                        </div>

                        <div class="flex shrink-0 gap-1.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => openEditDialog(group)}
                                aria-label="수정"
                            >
                                <Pencil class="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => deleteGroup(group)}
                                aria-label="삭제"
                            >
                                <Trash2 class="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    </Card.Content>
                </Card.Root>
            {/each}
        </div>
    {/if}
</div>

<Dialog.Root bind:open={showDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>
                {editingGroup ? '그룹 수정' : '새 그룹 추가'}
            </Dialog.Title>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
        >
            {#if !editingGroup}
                <div class="grid gap-2">
                    <Label for="group-id">그룹 ID</Label>
                    <Input
                        id="group-id"
                        bind:value={formId}
                        placeholder="community"
                        required
                        disabled={saving}
                    />
                    <p class="text-muted-foreground text-xs">영문, 숫자, 하이픈만 사용</p>
                </div>
            {/if}
            <div class="grid gap-2">
                <Label for="group-name">그룹 이름</Label>
                <Input
                    id="group-name"
                    bind:value={formName}
                    placeholder="커뮤니티"
                    required
                    disabled={saving}
                />
            </div>
            <div class="grid gap-2">
                <Label for="group-desc">설명 (선택)</Label>
                <Input
                    id="group-desc"
                    bind:value={formDescription}
                    placeholder="그룹 설명"
                    disabled={saving}
                />
            </div>
            <div class="flex items-center gap-3">
                <Switch bind:checked={formVisible} disabled={saving} />
                <Label>사이드바에 표시</Label>
            </div>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (showDialog = false)}
                    disabled={saving}
                >
                    취소
                </Button>
                <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

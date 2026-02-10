<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
    import FolderOpen from '@lucide/svelte/icons/folder-open';
    import { apiClient } from '$lib/api/index.js';
    import type { BoardGroup } from '$lib/api/types.js';
    import { goto } from '$app/navigation';

    interface Props {
        boardId: string;
        postId: number;
        currentCategory?: string;
        categoryList?: string; // pipe-separated
    }

    let { boardId, postId, currentCategory, categoryList }: Props = $props();

    // 카테고리 변경
    const categories = $derived(
        categoryList ? categoryList.split('|').filter((c) => c.trim()) : []
    );
    let isChangingCategory = $state(false);

    async function handleCategoryChange(newCategory: string): Promise<void> {
        if (newCategory === currentCategory) return;
        isChangingCategory = true;
        try {
            await apiClient.changePostCategory(boardId, postId, newCategory);
            window.location.reload();
        } catch (err) {
            console.error('카테고리 변경 실패:', err);
            alert('카테고리 변경에 실패했습니다.');
        } finally {
            isChangingCategory = false;
        }
    }

    // 게시글 이동
    let showMoveDialog = $state(false);
    let boardGroups = $state<BoardGroup[]>([]);
    let selectedBoardId = $state('');
    let isLoadingBoards = $state(false);
    let isMoving = $state(false);

    async function openMoveDialog(): Promise<void> {
        showMoveDialog = true;
        isLoadingBoards = true;
        try {
            boardGroups = await apiClient.getBoardGroups();
        } catch (err) {
            console.error('게시판 목록 로드 실패:', err);
        } finally {
            isLoadingBoards = false;
        }
    }

    async function handleMove(): Promise<void> {
        if (!selectedBoardId || selectedBoardId === boardId) return;
        isMoving = true;
        try {
            const result = await apiClient.movePost(boardId, postId, selectedBoardId);
            const newPostId = result.new_post_id || postId;
            goto(`/${selectedBoardId}/${newPostId}`);
        } catch (err) {
            console.error('게시글 이동 실패:', err);
            alert('게시글 이동에 실패했습니다.');
        } finally {
            isMoving = false;
        }
    }
</script>

<div class="flex items-center gap-2">
    <!-- 카테고리 변경 -->
    {#if categories.length > 0}
        <Select.Root
            type="single"
            value={currentCategory ? { value: currentCategory, label: currentCategory } : undefined}
            onValueChange={(v) => {
                if (v?.value) handleCategoryChange(v.value);
            }}
            disabled={isChangingCategory}
        >
            <Select.Trigger class="h-8 w-auto min-w-[120px] text-xs">
                <FolderOpen class="mr-1 h-3.5 w-3.5" />
                {currentCategory || '카테고리'}
            </Select.Trigger>
            <Select.Content>
                {#each categories as cat (cat)}
                    <Select.Item value={cat} label={cat}>{cat}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
    {/if}

    <!-- 게시글 이동 -->
    <Button variant="outline" size="sm" onclick={openMoveDialog}>
        <ArrowRightLeft class="mr-1 h-4 w-4" />
        이동
    </Button>
</div>

<!-- 이동 다이얼로그 -->
<Dialog.Root bind:open={showMoveDialog}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>게시글 이동</Dialog.Title>
            <Dialog.Description>이 게시글을 다른 게시판으로 이동합니다.</Dialog.Description>
        </Dialog.Header>

        <div class="py-4">
            {#if isLoadingBoards}
                <div class="text-muted-foreground py-4 text-center text-sm">
                    게시판 목록을 불러오는 중...
                </div>
            {:else}
                <Select.Root
                    type="single"
                    onValueChange={(v) => {
                        if (v?.value) selectedBoardId = v.value;
                    }}
                >
                    <Select.Trigger class="w-full">
                        {selectedBoardId || '이동할 게시판 선택'}
                    </Select.Trigger>
                    <Select.Content class="max-h-60">
                        {#each boardGroups as group (group.id)}
                            {#if group.boards && group.boards.length > 0}
                                <Select.Group>
                                    <Select.GroupHeading>{group.name}</Select.GroupHeading>
                                    {#each group.boards as board (board.board_id)}
                                        {#if board.board_id !== boardId}
                                            <Select.Item
                                                value={board.board_id}
                                                label={board.subject}
                                            >
                                                {board.subject}
                                            </Select.Item>
                                        {/if}
                                    {/each}
                                </Select.Group>
                            {/if}
                        {/each}
                    </Select.Content>
                </Select.Root>
            {/if}
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => (showMoveDialog = false)}>취소</Button>
            <Button
                onclick={handleMove}
                disabled={!selectedBoardId || selectedBoardId === boardId || isMoving}
            >
                {isMoving ? '이동 중...' : '이동'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

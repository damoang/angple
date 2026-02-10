<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
    import X from '@lucide/svelte/icons/x';
    import CheckSquare from '@lucide/svelte/icons/check-square';
    import { apiClient } from '$lib/api/index.js';
    import type { BoardGroup } from '$lib/api/types.js';

    interface Props {
        boardId: string;
        selectedIds: number[];
        onClearSelection: () => void;
        onActionComplete: () => void;
    }

    let { boardId, selectedIds, onClearSelection, onActionComplete }: Props = $props();

    // 일괄 삭제
    let showDeleteConfirm = $state(false);
    let isDeleting = $state(false);

    async function handleBulkDelete(): Promise<void> {
        isDeleting = true;
        try {
            await apiClient.bulkDeletePosts(boardId, selectedIds);
            showDeleteConfirm = false;
            onClearSelection();
            onActionComplete();
        } catch (err) {
            console.error('일괄 삭제 실패:', err);
            alert('일괄 삭제에 실패했습니다.');
        } finally {
            isDeleting = false;
        }
    }

    // 일괄 이동
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

    async function handleBulkMove(): Promise<void> {
        if (!selectedBoardId || selectedBoardId === boardId) return;
        isMoving = true;
        try {
            await apiClient.bulkMovePosts(boardId, selectedIds, selectedBoardId);
            showMoveDialog = false;
            onClearSelection();
            onActionComplete();
        } catch (err) {
            console.error('일괄 이동 실패:', err);
            alert('일괄 이동에 실패했습니다.');
        } finally {
            isMoving = false;
        }
    }
</script>

{#if selectedIds.length > 0}
    <div
        class="bg-primary/5 border-primary/20 sticky top-0 z-10 flex items-center gap-3 rounded-lg border px-4 py-3"
    >
        <CheckSquare class="text-primary h-5 w-5 shrink-0" />
        <span class="text-foreground text-sm font-medium">
            {selectedIds.length}개 선택됨
        </span>

        <div class="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onclick={openMoveDialog}>
                <ArrowRightLeft class="mr-1 h-4 w-4" />
                이동
            </Button>
            <Button variant="destructive" size="sm" onclick={() => (showDeleteConfirm = true)}>
                <Trash2 class="mr-1 h-4 w-4" />
                삭제
            </Button>
            <Button variant="ghost" size="sm" onclick={onClearSelection}>
                <X class="h-4 w-4" />
            </Button>
        </div>
    </div>
{/if}

<!-- 삭제 확인 다이얼로그 -->
<Dialog.Root bind:open={showDeleteConfirm}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>게시글 일괄 삭제</Dialog.Title>
            <Dialog.Description>
                선택한 {selectedIds.length}개의 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수
                없습니다.
            </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button variant="outline" onclick={() => (showDeleteConfirm = false)}>취소</Button>
            <Button variant="destructive" onclick={handleBulkDelete} disabled={isDeleting}>
                {isDeleting ? '삭제 중...' : '삭제'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- 이동 다이얼로그 -->
<Dialog.Root bind:open={showMoveDialog}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>게시글 일괄 이동</Dialog.Title>
            <Dialog.Description>
                선택한 {selectedIds.length}개의 게시글을 다른 게시판으로 이동합니다.
            </Dialog.Description>
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
                        if (v) selectedBoardId = v;
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
                onclick={handleBulkMove}
                disabled={!selectedBoardId || selectedBoardId === boardId || isMoving}
            >
                {isMoving ? '이동 중...' : '이동'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

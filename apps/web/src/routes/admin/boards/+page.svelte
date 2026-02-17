<script lang="ts">
    /**
     * 관리자 게시판 관리 페이지
     * 게시판 목록 + 생성/수정/삭제
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import FileText from '@lucide/svelte/icons/file-text';
    import Plus from '@lucide/svelte/icons/plus';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Settings from '@lucide/svelte/icons/settings';
    import Search from '@lucide/svelte/icons/search';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import type { Board, BoardGroup } from '$lib/api/types';
    import {
        listBoards,
        listBoardGroups,
        createBoard,
        updateBoard,
        deleteBoard,
        type CreateBoardRequest,
        type UpdateBoardRequest
    } from '$lib/api/admin-boards';

    let boards = $state<Board[]>([]);
    let groups = $state<BoardGroup[]>([]);
    let loading = $state(true);
    let searchQuery = $state('');

    // 다이얼로그 상태
    let showDialog = $state(false);
    let editingBoard = $state<Board | null>(null);
    let saving = $state(false);

    // 폼 필드
    let formBoardId = $state('');
    let formSubject = $state('');
    let formGroupId = $state('');
    let formBoardType = $state('standard');
    let formPageRows = $state(20);
    let formListLevel = $state(1);
    let formReadLevel = $state(1);
    let formWriteLevel = $state(2);
    let formCommentLevel = $state(2);
    let formUseCategory = $state(false);
    let formCategoryList = $state('');
    let formUseGood = $state(true);
    let formUseNogood = $state(true);
    let formUploadCount = $state(5);

    const filteredBoards = $derived(
        searchQuery.trim()
            ? boards.filter(
                    (b) =>
                        b.board_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.subject.toLowerCase().includes(searchQuery.toLowerCase())
                )
            : boards
    );

    async function fetchData() {
        loading = true;
        try {
            const [boardsData, groupsData] = await Promise.allSettled([
                listBoards(),
                listBoardGroups()
            ]);
            if (boardsData.status === 'fulfilled') boards = boardsData.value;
            if (groupsData.status === 'fulfilled') groups = groupsData.value;
        } catch {
            // 에러는 API 함수에서 이미 로깅됨
        } finally {
            loading = false;
        }
    }

    function openCreateDialog() {
        editingBoard = null;
        formBoardId = '';
        formSubject = '';
        formGroupId = groups[0]?.id ?? '';
        formBoardType = 'standard';
        formPageRows = 20;
        formListLevel = 1;
        formReadLevel = 1;
        formWriteLevel = 2;
        formCommentLevel = 2;
        formUseCategory = false;
        formCategoryList = '';
        formUseGood = true;
        formUseNogood = true;
        formUploadCount = 5;
        showDialog = true;
    }

    function openEditDialog(board: Board) {
        editingBoard = board;
        formBoardId = board.board_id;
        formSubject = board.subject;
        formGroupId = board.group_id;
        formBoardType = board.board_type ?? 'standard';
        formPageRows = board.page_rows;
        formListLevel = board.list_level;
        formReadLevel = board.read_level;
        formWriteLevel = board.write_level;
        formCommentLevel = board.comment_level;
        formUseCategory = board.use_category === 1;
        formCategoryList = board.category_list ?? '';
        formUseGood = board.use_good === 1;
        formUseNogood = board.use_nogood === 1;
        formUploadCount = board.upload_count;
        showDialog = true;
    }

    async function handleSave() {
        if (!formSubject.trim()) return;
        saving = true;
        try {
            if (editingBoard) {
                const request: UpdateBoardRequest = {
                    group_id: formGroupId,
                    subject: formSubject,
                    board_type: formBoardType,
                    page_rows: formPageRows,
                    list_level: formListLevel,
                    read_level: formReadLevel,
                    write_level: formWriteLevel,
                    comment_level: formCommentLevel,
                    use_category: formUseCategory ? 1 : 0,
                    category_list: formCategoryList,
                    use_good: formUseGood ? 1 : 0,
                    use_nogood: formUseNogood ? 1 : 0,
                    upload_count: formUploadCount
                };
                await updateBoard(editingBoard.board_id, request);
            } else {
                if (!formBoardId.trim()) return;
                const request: CreateBoardRequest = {
                    board_id: formBoardId,
                    group_id: formGroupId,
                    subject: formSubject,
                    board_type: formBoardType,
                    page_rows: formPageRows,
                    list_level: formListLevel,
                    read_level: formReadLevel,
                    write_level: formWriteLevel,
                    comment_level: formCommentLevel,
                    use_category: formUseCategory ? 1 : 0,
                    category_list: formCategoryList,
                    use_good: formUseGood ? 1 : 0,
                    use_nogood: formUseNogood ? 1 : 0,
                    upload_count: formUploadCount
                };
                await createBoard(request);
            }
            showDialog = false;
            await fetchData();
        } catch (err) {
            console.error('저장 실패:', err);
            alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            saving = false;
        }
    }

    async function handleDelete(board: Board) {
        if (
            !confirm(
                `"${board.subject}" (${board.board_id}) 게시판을 삭제하시겠습니까?\n\n이 게시판의 모든 게시글이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
            )
        )
            return;
        try {
            await deleteBoard(board.board_id);
            await fetchData();
        } catch (err) {
            console.error('삭제 실패:', err);
            alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
        }
    }

    function getGroupName(groupId: string): string {
        return groups.find((g) => g.id === groupId)?.name ?? groupId;
    }

    function getLevelLabel(level: number): string {
        if (level <= 0) return '비회원';
        if (level <= 1) return '전체';
        if (level < 10) return `레벨 ${level}+`;
        return '관리자';
    }

    const boardTypes: Record<string, string> = {
        standard: '일반',
        qa: 'Q&A',
        giving: '나눔',
        angtt: 'TT',
        angmap: '지도',
        'used-market': '중고장터'
    };

    onMount(() => {
        fetchData();
    });
</script>

<svelte:head>
    <title>게시판 관리 - Angple Admin</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">게시판 관리</h1>
            <p class="text-muted-foreground text-sm">
                게시판을 생성하고 설정을 관리합니다.
            </p>
        </div>
        <Button onclick={openCreateDialog}>
            <Plus class="mr-1.5 h-4 w-4" />
            게시판 추가
        </Button>
    </div>

    <!-- 검색 -->
    <div class="relative">
        <Search class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
            bind:value={searchQuery}
            placeholder="게시판 이름 또는 ID로 검색..."
            class="pl-9"
        />
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
            <span class="text-muted-foreground ml-2 text-sm">로딩 중...</span>
        </div>
    {:else if filteredBoards.length === 0}
        <Card.Root>
            <Card.Content class="flex flex-col items-center justify-center py-12">
                <FileText class="text-muted-foreground mb-4 h-12 w-12" />
                {#if searchQuery}
                    <p class="text-muted-foreground mb-2">검색 결과가 없습니다.</p>
                    <Button variant="outline" onclick={() => (searchQuery = '')}>
                        검색 초기화
                    </Button>
                {:else}
                    <p class="text-muted-foreground mb-4">게시판이 없습니다.</p>
                    <Button onclick={openCreateDialog}>
                        <Plus class="mr-1.5 h-4 w-4" />
                        첫 게시판 만들기
                    </Button>
                {/if}
            </Card.Content>
        </Card.Root>
    {:else}
        <!-- 게시판 테이블 -->
        <Card.Root>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="p-3 text-left font-medium">게시판</th>
                            <th class="p-3 text-left font-medium">그룹</th>
                            <th class="p-3 text-center font-medium">게시글</th>
                            <th class="p-3 text-center font-medium">댓글</th>
                            <th class="p-3 text-center font-medium">쓰기 권한</th>
                            <th class="p-3 text-right font-medium">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each filteredBoards as board (board.board_id)}
                            <tr class="hover:bg-muted/50 border-b transition-colors">
                                <td class="p-3">
                                    <div class="flex items-center gap-2">
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <a
                                                    href="/{board.board_id}"
                                                    class="hover:text-primary font-medium"
                                                >
                                                    {board.subject}
                                                </a>
                                                {#if board.board_type && board.board_type !== 'standard'}
                                                    <Badge variant="outline" class="text-xs">
                                                        {boardTypes[board.board_type] ??
                                                            board.board_type}
                                                    </Badge>
                                                {/if}
                                            </div>
                                            <p class="text-muted-foreground text-xs">
                                                /{board.board_id}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-3">
                                    <Badge variant="secondary" class="text-xs">
                                        {getGroupName(board.group_id)}
                                    </Badge>
                                </td>
                                <td class="p-3 text-center">
                                    <div class="flex items-center justify-center gap-1">
                                        <FileText class="h-3.5 w-3.5 opacity-50" />
                                        {board.count_write.toLocaleString()}
                                    </div>
                                </td>
                                <td class="p-3 text-center">
                                    <div class="flex items-center justify-center gap-1">
                                        <MessageSquare class="h-3.5 w-3.5 opacity-50" />
                                        {board.count_comment.toLocaleString()}
                                    </div>
                                </td>
                                <td class="p-3 text-center">
                                    <Badge
                                        variant={board.write_level >= 10
                                            ? 'destructive'
                                            : 'outline'}
                                        class="text-xs"
                                    >
                                        {getLevelLabel(board.write_level)}
                                    </Badge>
                                </td>
                                <td class="p-3 text-right">
                                    <div class="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            href="/admin/boards/{board.board_id}/view-settings"
                                            title="표시 설정"
                                        >
                                            <Settings class="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() => openEditDialog(board)}
                                            title="수정"
                                        >
                                            <Pencil class="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() => handleDelete(board)}
                                            title="삭제"
                                        >
                                            <Trash2 class="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </Card.Root>
        <p class="text-muted-foreground text-xs">
            총 {filteredBoards.length}개 게시판
            {#if searchQuery}(검색: "{searchQuery}"){/if}
        </p>
    {/if}
</div>

<!-- 게시판 생성/수정 다이얼로그 -->
<Dialog.Root bind:open={showDialog}>
    <Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <Dialog.Header>
            <Dialog.Title>
                {editingBoard ? `게시판 수정: ${editingBoard.subject}` : '새 게시판 추가'}
            </Dialog.Title>
            <Dialog.Description>
                {editingBoard ? '게시판 설정을 변경합니다.' : '새 게시판을 생성합니다.'}
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="space-y-5"
            onsubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
        >
            <!-- 기본 정보 -->
            <div class="space-y-3">
                <h3 class="text-sm font-semibold">기본 정보</h3>
                {#if !editingBoard}
                    <div class="grid gap-2">
                        <Label for="board-id">게시판 ID</Label>
                        <Input
                            id="board-id"
                            bind:value={formBoardId}
                            placeholder="free"
                            required
                            disabled={saving}
                            pattern="[a-z0-9-]+"
                        />
                        <p class="text-muted-foreground text-xs">
                            URL에 사용됩니다. 영문 소문자, 숫자, 하이픈만 가능합니다.
                        </p>
                    </div>
                {/if}
                <div class="grid gap-2">
                    <Label for="board-subject">게시판 이름</Label>
                    <Input
                        id="board-subject"
                        bind:value={formSubject}
                        placeholder="자유게시판"
                        required
                        disabled={saving}
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="board-group">그룹</Label>
                    <select
                        id="board-group"
                        bind:value={formGroupId}
                        disabled={saving}
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        {#each groups as group (group.id)}
                            <option value={group.id}>{group.name}</option>
                        {/each}
                    </select>
                </div>
                <div class="grid gap-2">
                    <Label for="board-type">게시판 타입</Label>
                    <select
                        id="board-type"
                        bind:value={formBoardType}
                        disabled={saving}
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        {#each Object.entries(boardTypes) as [value, label] (value)}
                            <option {value}>{label}</option>
                        {/each}
                    </select>
                </div>
            </div>

            <!-- 권한 설정 -->
            <div class="space-y-3">
                <h3 class="text-sm font-semibold">권한 설정</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-1.5">
                        <Label for="list-level" class="text-xs">목록 보기</Label>
                        <Input
                            id="list-level"
                            type="number"
                            min="0"
                            max="10"
                            bind:value={formListLevel}
                            disabled={saving}
                        />
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="read-level" class="text-xs">글 읽기</Label>
                        <Input
                            id="read-level"
                            type="number"
                            min="0"
                            max="10"
                            bind:value={formReadLevel}
                            disabled={saving}
                        />
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="write-level" class="text-xs">글 쓰기</Label>
                        <Input
                            id="write-level"
                            type="number"
                            min="0"
                            max="10"
                            bind:value={formWriteLevel}
                            disabled={saving}
                        />
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="comment-level" class="text-xs">댓글 쓰기</Label>
                        <Input
                            id="comment-level"
                            type="number"
                            min="0"
                            max="10"
                            bind:value={formCommentLevel}
                            disabled={saving}
                        />
                    </div>
                </div>
                <p class="text-muted-foreground text-xs">
                    0=비회원, 1=전체 회원, 2~9=해당 레벨 이상, 10=관리자만
                </p>
            </div>

            <!-- 기능 설정 -->
            <div class="space-y-3">
                <h3 class="text-sm font-semibold">기능 설정</h3>
                <div class="grid gap-2">
                    <Label for="page-rows" class="text-xs">페이지당 글 수</Label>
                    <Input
                        id="page-rows"
                        type="number"
                        min="5"
                        max="100"
                        bind:value={formPageRows}
                        disabled={saving}
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="upload-count" class="text-xs">첨부 파일 수</Label>
                    <Input
                        id="upload-count"
                        type="number"
                        min="0"
                        max="20"
                        bind:value={formUploadCount}
                        disabled={saving}
                    />
                </div>
                <div class="flex items-center gap-3">
                    <Switch bind:checked={formUseGood} disabled={saving} />
                    <Label class="text-xs">추천 기능 사용</Label>
                </div>
                <div class="flex items-center gap-3">
                    <Switch bind:checked={formUseNogood} disabled={saving} />
                    <Label class="text-xs">비추천 기능 사용</Label>
                </div>
                <div class="flex items-center gap-3">
                    <Switch bind:checked={formUseCategory} disabled={saving} />
                    <Label class="text-xs">카테고리 사용</Label>
                </div>
                {#if formUseCategory}
                    <div class="grid gap-2">
                        <Label for="category-list" class="text-xs">카테고리 목록</Label>
                        <Input
                            id="category-list"
                            bind:value={formCategoryList}
                            placeholder="일반|질문|정보|후기"
                            disabled={saving}
                        />
                        <p class="text-muted-foreground text-xs">| 로 구분합니다.</p>
                    </div>
                {/if}
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
                    {#if saving}
                        <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                    {/if}
                    {saving ? '저장 중...' : editingBoard ? '수정' : '생성'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

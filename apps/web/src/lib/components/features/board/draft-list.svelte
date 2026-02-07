<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import FileText from '@lucide/svelte/icons/file-text';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Clock from '@lucide/svelte/icons/clock';
    import FolderOpen from '@lucide/svelte/icons/folder-open';

    interface Props {
        onLoad?: (draft: DraftItem) => void;
    }

    let { onLoad }: Props = $props();

    // 임시저장 데이터 타입
    interface DraftItem {
        key: string;
        title: string;
        content: string;
        category: string;
        isSecret: boolean;
        savedAt: string;
        boardId: string;
    }

    // 임시저장 목록
    let drafts = $state<DraftItem[]>([]);
    let showDialog = $state(false);

    // 모든 임시저장 불러오기
    function loadAllDrafts(): void {
        if (!browser) return;

        const allDrafts: DraftItem[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('draft_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '');
                    if (data.title || data.content) {
                        // 키에서 boardId 추출 (draft_boardId_new 또는 draft_boardId_postId)
                        const parts = key.split('_');
                        const boardId = parts[1] || 'unknown';

                        allDrafts.push({
                            key,
                            title: data.title || '제목 없음',
                            content: data.content || '',
                            category: data.category || '',
                            isSecret: data.isSecret || false,
                            savedAt: data.savedAt,
                            boardId
                        });
                    }
                } catch {
                    // 파싱 실패시 무시
                }
            }
        }

        // 최신순 정렬
        allDrafts.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        drafts = allDrafts;
    }

    // 임시저장 삭제
    function deleteDraft(key: string): void {
        if (!browser) return;
        if (!confirm('임시저장을 삭제하시겠습니까?')) return;

        localStorage.removeItem(key);
        drafts = drafts.filter((d) => d.key !== key);
    }

    // 임시저장 불러오기
    function handleLoad(draft: DraftItem): void {
        if (onLoad) {
            onLoad(draft);
        }
        showDialog = false;
    }

    // 날짜 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 내용 미리보기 (50자)
    function getPreview(content: string): string {
        const plain = content.replace(/[#*`>\-[\]()]/g, '').trim();
        return plain.length > 50 ? plain.slice(0, 50) + '...' : plain;
    }

    // 게시판 이름
    function getBoardName(boardId: string): string {
        const boardNames: Record<string, string> = {
            free: '자유게시판',
            notice: '공지사항',
            qna: 'Q&A'
        };
        return boardNames[boardId] || boardId;
    }

    // 다이얼로그 열 때 목록 새로고침
    function openDialog(): void {
        loadAllDrafts();
        showDialog = true;
    }
</script>

<!-- 임시저장 목록 버튼 -->
<Button variant="outline" size="sm" onclick={openDialog}>
    <FolderOpen class="mr-1.5 h-4 w-4" />
    임시저장 ({drafts.length})
</Button>

<!-- 임시저장 목록 다이얼로그 -->
<Dialog.Root bind:open={showDialog}>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <FileText class="h-5 w-5" />
                임시저장 목록
            </Dialog.Title>
            <Dialog.Description>
                자동 저장된 글 목록입니다. 불러오기를 클릭하면 작성 중인 내용에 덮어씁니다.
            </Dialog.Description>
        </Dialog.Header>

        <div class="max-h-96 overflow-y-auto">
            {#if drafts.length === 0}
                <div class="text-muted-foreground py-8 text-center">
                    <FileText class="mx-auto mb-3 h-10 w-10" />
                    <p>임시저장된 글이 없습니다.</p>
                </div>
            {:else}
                <ul class="divide-border divide-y">
                    {#each drafts as draft (draft.key)}
                        <li class="py-3 first:pt-0 last:pb-0">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <h4 class="text-foreground truncate font-medium">
                                        {draft.title || '제목 없음'}
                                    </h4>
                                    <p class="text-muted-foreground mt-0.5 truncate text-sm">
                                        {getPreview(draft.content)}
                                    </p>
                                    <div
                                        class="text-muted-foreground mt-1.5 flex items-center gap-2 text-xs"
                                    >
                                        <span class="bg-muted rounded px-1.5 py-0.5">
                                            {getBoardName(draft.boardId)}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <Clock class="h-3 w-3" />
                                            {formatDate(draft.savedAt)}
                                        </span>
                                    </div>
                                </div>
                                <div class="flex shrink-0 gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => handleLoad(draft)}
                                    >
                                        불러오기
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => deleteDraft(draft.key)}
                                        class="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>

<script lang="ts">
    /**
     * 수정 이력 뷰어
     *
     * 게시물의 수정 이력을 시간순으로 표시하고
     * 버전 간 diff를 확인할 수 있습니다.
     */

    import {
        Clock,
        ChevronDown,
        ChevronUp,
        FileText,
        Trash2,
        RotateCcw,
        Edit
    } from '@lucide/svelte';

    interface HistoryEntry {
        version: number;
        title: string;
        content: string;
        editedBy: string;
        editedAt: string;
        changeType: 'create' | 'update' | 'soft_delete' | 'restore';
    }

    interface Props {
        postId: string | number;
        history: HistoryEntry[];
        isAdmin?: boolean;
    }

    let { postId, history = [], isAdmin = false }: Props = $props();

    let isExpanded = $state(false);
    let selectedVersion = $state<number | null>(null);

    /** 변경 타입 라벨 */
    function getChangeLabel(type: string): string {
        switch (type) {
            case 'create':
                return '최초 작성';
            case 'update':
                return '수정';
            case 'soft_delete':
                return '삭제';
            case 'restore':
                return '복구';
            default:
                return type;
        }
    }

    /** 변경 타입 아이콘 */
    function getChangeIcon(type: string) {
        switch (type) {
            case 'create':
                return FileText;
            case 'update':
                return Edit;
            case 'soft_delete':
                return Trash2;
            case 'restore':
                return RotateCcw;
            default:
                return FileText;
        }
    }

    /** 변경 타입 색상 */
    function getChangeColor(type: string): string {
        switch (type) {
            case 'create':
                return 'text-green-600';
            case 'update':
                return 'text-blue-600';
            case 'soft_delete':
                return 'text-red-600';
            case 'restore':
                return 'text-orange-600';
            default:
                return 'text-muted-foreground';
        }
    }

    function formatDate(dateStr: string): string {
        try {
            return new Date(dateStr).toLocaleString('ko-KR');
        } catch {
            return dateStr;
        }
    }

    /** 간단한 텍스트 diff (줄 단위) */
    function getSimpleDiff(
        oldText: string,
        newText: string
    ): { added: string[]; removed: string[] } {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');

        const removed = oldLines.filter((line) => !newLines.includes(line));
        const added = newLines.filter((line) => !oldLines.includes(line));

        return { added, removed };
    }

    const sortedHistory = $derived([...history].sort((a, b) => b.version - a.version));
</script>

{#if history.length > 0}
    <div class="mt-6 rounded-lg border">
        <!-- 헤더 -->
        <button
            class="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 transition-colors"
            onclick={() => (isExpanded = !isExpanded)}
        >
            <div class="flex items-center gap-2">
                <Clock class="text-muted-foreground h-4 w-4" />
                <span class="text-sm font-medium">수정 이력 ({history.length}개 버전)</span>
            </div>
            {#if isExpanded}
                <ChevronUp class="text-muted-foreground h-4 w-4" />
            {:else}
                <ChevronDown class="text-muted-foreground h-4 w-4" />
            {/if}
        </button>

        <!-- 이력 목록 -->
        {#if isExpanded}
            <div class="divide-y border-t">
                {#each sortedHistory as entry (entry.version)}
                    {@const Icon = getChangeIcon(entry.changeType)}
                    <div class="px-4 py-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <Icon class="h-3.5 w-3.5 {getChangeColor(entry.changeType)}" />
                                <span class="text-sm font-medium">v{entry.version}</span>
                                <span class="text-muted-foreground text-xs">
                                    {getChangeLabel(entry.changeType)}
                                </span>
                            </div>
                            <div class="text-muted-foreground flex items-center gap-2 text-xs">
                                <span>{entry.editedBy}</span>
                                <span>{formatDate(entry.editedAt)}</span>
                            </div>
                        </div>

                        <!-- 제목 변경 -->
                        {#if entry.title}
                            <p class="text-muted-foreground mt-1 text-xs">
                                제목: {entry.title}
                            </p>
                        {/if}

                        <!-- 상세 보기 버튼 -->
                        {#if isAdmin}
                            <button
                                class="text-primary mt-1 text-xs hover:underline"
                                onclick={() =>
                                    (selectedVersion =
                                        selectedVersion === entry.version ? null : entry.version)}
                            >
                                {selectedVersion === entry.version ? '접기' : '내용 보기'}
                            </button>

                            {#if selectedVersion === entry.version}
                                <div
                                    class="bg-muted/50 mt-2 max-h-60 overflow-y-auto rounded p-3 text-sm"
                                >
                                    {entry.content || '(내용 없음)'}
                                </div>
                            {/if}
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/if}

<script lang="ts">
    /**
     * 게시물 수정 이력 타임라인 뷰
     * 코어 컴포넌트 - 게시물 상세 페이지 하단에 배치
     */
    import type { PostRevision } from '$lib/api/types.js';
    import RevisionDiff from './revision-diff.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import Clock from '@lucide/svelte/icons/clock';
    import FileText from '@lucide/svelte/icons/file-text';
    import Edit from '@lucide/svelte/icons/edit';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ChevronUp from '@lucide/svelte/icons/chevron-up';

    interface Props {
        revisions: PostRevision[];
        isAdmin?: boolean;
        canRestore?: boolean;
        onRestore?: (version: number) => Promise<void> | void;
    }

    let { revisions, isAdmin = false, canRestore = false, onRestore }: Props = $props();

    let isExpanded = $state(false);
    let selectedVersion = $state<number | null>(null);
    let compareVersion = $state<number | null>(null);
    let restoringVersion = $state<number | null>(null);

    const sortedRevisions = $derived([...revisions].sort((a, b) => b.version - a.version));

    const selectedRevision = $derived(
        selectedVersion !== null
            ? (revisions.find((r) => r.version === selectedVersion) ?? null)
            : null
    );

    const compareRevision = $derived(
        compareVersion !== null
            ? (revisions.find((r) => r.version === compareVersion) ?? null)
            : null
    );

    function getIcon(type: PostRevision['change_type']) {
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
                return Edit;
        }
    }

    function getColor(type: PostRevision['change_type']): string {
        switch (type) {
            case 'create':
                return 'text-green-600 dark:text-green-400';
            case 'update':
                return 'text-blue-600 dark:text-blue-400';
            case 'soft_delete':
                return 'text-red-600 dark:text-red-400';
            case 'restore':
                return 'text-orange-600 dark:text-orange-400';
            default:
                return 'text-neutral-600 dark:text-neutral-400';
        }
    }

    function getLabel(type: PostRevision['change_type']): string {
        switch (type) {
            case 'create':
                return '작성';
            case 'update':
                return '수정';
            case 'soft_delete':
                return '삭제';
            case 'restore':
                return '복원';
            default:
                return '변경';
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString('ko-KR');
    }

    function toggleVersion(version: number) {
        if (selectedVersion === version) {
            selectedVersion = null;
            compareVersion = null;
        } else if (selectedVersion === null) {
            selectedVersion = version;
            // 자동으로 이전 버전 선택
            const prev = revisions.find((r) => r.version === version - 1);
            compareVersion = prev ? prev.version : null;
        } else {
            compareVersion = version;
        }
    }

    async function handleRestore(version: number) {
        if (!onRestore || restoringVersion !== null) return;
        restoringVersion = version;
        try {
            await onRestore(version);
        } finally {
            restoringVersion = null;
        }
    }
</script>

{#if revisions.length > 0}
    <div class="mt-6 border-t pt-4 dark:border-neutral-700">
        <button
            class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm font-medium transition-colors"
            onclick={() => (isExpanded = !isExpanded)}
            aria-expanded={isExpanded}
            aria-label="수정 이력 표시/숨김"
        >
            <Clock class="h-4 w-4" />
            수정 이력 ({revisions.length}개 버전)
            {#if isExpanded}
                <ChevronUp class="ml-auto h-4 w-4" />
            {:else}
                <ChevronDown class="ml-auto h-4 w-4" />
            {/if}
        </button>

        {#if isExpanded}
            <div class="mt-4 space-y-3">
                {#each sortedRevisions as rev (rev.version)}
                    {@const IconComp = getIcon(rev.change_type)}
                    {@const isSelected =
                        selectedVersion === rev.version || compareVersion === rev.version}
                    <div
                        class="rounded-lg border p-3 transition-colors dark:border-neutral-700 {isSelected
                            ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20'
                            : ''}"
                    >
                        <div class="flex items-center gap-3">
                            <div class={getColor(rev.change_type)}>
                                <IconComp class="h-4 w-4" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 text-sm">
                                    <span class="font-medium">v{rev.version}</span>
                                    <span class={`text-xs ${getColor(rev.change_type)}`}>
                                        {getLabel(rev.change_type)}
                                    </span>
                                    <span class="text-muted-foreground text-xs">
                                        {rev.edited_by_name ?? rev.edited_by}
                                    </span>
                                    <span class="text-muted-foreground text-xs">
                                        {formatDate(rev.edited_at)}
                                    </span>
                                </div>
                            </div>
                            <div class="flex shrink-0 gap-1.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => toggleVersion(rev.version)}
                                    class="h-7 text-xs"
                                >
                                    {isSelected ? '닫기' : '비교'}
                                </Button>
                                {#if canRestore && rev.change_type !== 'create'}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => handleRestore(rev.version)}
                                        disabled={restoringVersion !== null}
                                        class="h-7 text-xs"
                                    >
                                        <RotateCcw class="mr-1 h-3 w-3" />
                                        {restoringVersion === rev.version ? '복원 중...' : '복원'}
                                    </Button>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/each}

                {#if selectedRevision && compareRevision}
                    <div class="mt-4 space-y-3">
                        <h4 class="text-sm font-medium">
                            v{compareRevision.version} → v{selectedRevision.version} 비교
                        </h4>
                        {#if compareRevision.title !== selectedRevision.title}
                            <div>
                                <p class="text-muted-foreground mb-1 text-xs font-medium">
                                    제목 변경
                                </p>
                                <RevisionDiff
                                    oldText={compareRevision.title}
                                    newText={selectedRevision.title}
                                    oldLabel="v{compareRevision.version}"
                                    newLabel="v{selectedRevision.version}"
                                />
                            </div>
                        {/if}
                        <div>
                            <p class="text-muted-foreground mb-1 text-xs font-medium">본문 변경</p>
                            <RevisionDiff
                                oldText={compareRevision.content}
                                newText={selectedRevision.content}
                                oldLabel="v{compareRevision.version}"
                                newLabel="v{selectedRevision.version}"
                            />
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
{/if}

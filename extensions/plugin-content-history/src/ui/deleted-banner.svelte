<script lang="ts">
    /**
     * 삭제된 게시물 배너
     *
     * 소프트 삭제된 게시물 상단에 표시되는 경고 배너.
     * 관리자에게는 복구 버튼을 표시합니다.
     */

    import { AlertTriangle, RotateCcw } from '@lucide/svelte';

    interface Props {
        postId: string | number;
        deletedAt?: string;
        deletedBy?: string;
        isAdmin?: boolean;
        onRestore?: (postId: string | number) => void;
    }

    let { postId, deletedAt, deletedBy, isAdmin = false, onRestore }: Props = $props();

    let isRestoring = $state(false);

    async function handleRestore() {
        if (!onRestore) return;
        isRestoring = true;
        try {
            onRestore(postId);
        } finally {
            isRestoring = false;
        }
    }

    function formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleString('ko-KR');
        } catch {
            return dateStr;
        }
    }
</script>

{#if deletedAt}
    <div
        class="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
    >
        <div class="flex items-center gap-3">
            <AlertTriangle class="h-5 w-5 flex-shrink-0 text-red-500" />
            <div>
                <p class="font-medium text-red-700 dark:text-red-400">삭제된 게시물입니다</p>
                <p class="text-sm text-red-600 dark:text-red-500">
                    {formatDate(deletedAt)}에 삭제됨
                    {#if deletedBy}
                        · 삭제자: {deletedBy}
                    {/if}
                </p>
            </div>
        </div>

        {#if isAdmin && onRestore}
            <button
                class="flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                onclick={handleRestore}
                disabled={isRestoring}
            >
                <RotateCcw class="h-3.5 w-3.5" />
                {isRestoring ? '복구 중...' : '복구'}
            </button>
        {/if}
    </div>
{/if}

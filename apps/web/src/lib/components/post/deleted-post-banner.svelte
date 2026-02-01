<script lang="ts">
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import { Button } from '$lib/components/ui/button/index.js';

    interface Props {
        postId: string | number;
        deletedAt?: string;
        deletedBy?: string;
        isAdmin?: boolean;
        onRestore?: (postId: string | number) => Promise<void> | void;
    }

    let { postId, deletedAt, deletedBy, isAdmin = false, onRestore }: Props = $props();

    let isRestoring = $state(false);

    async function handleRestore() {
        if (!onRestore || isRestoring) return;
        isRestoring = true;
        try {
            await onRestore(postId);
        } finally {
            isRestoring = false;
        }
    }

    const formattedDate = $derived(
        deletedAt ? new Date(deletedAt).toLocaleString('ko-KR') : null
    );
</script>

<div
    class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
    role="alert"
    aria-live="polite"
>
    <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div class="flex-1">
            <p class="font-medium text-red-800 dark:text-red-300">
                이 게시물은 삭제되었습니다.
            </p>
            {#if formattedDate || deletedBy}
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {#if deletedBy}삭제자: {deletedBy}{/if}
                    {#if deletedBy && formattedDate} · {/if}
                    {#if formattedDate}삭제일: {formattedDate}{/if}
                </p>
            {/if}
        </div>
        {#if isAdmin && onRestore}
            <Button
                variant="outline"
                size="sm"
                onclick={handleRestore}
                disabled={isRestoring}
                class="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
            >
                <RotateCcw class="mr-1.5 h-4 w-4" />
                {isRestoring ? '복구 중...' : '복구'}
            </Button>
        {/if}
    </div>
</div>

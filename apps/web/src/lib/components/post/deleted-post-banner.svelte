<script lang="ts">
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

    interface Props {
        postId: string | number;
        deletedAt?: string;
        deletedBy?: string;
    }

    let { postId: _postId, deletedAt, deletedBy }: Props = $props();

    const formattedDate = $derived(deletedAt ? new Date(deletedAt).toLocaleString('ko-KR') : null);
</script>

<div
    class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
    role="alert"
    aria-live="polite"
>
    <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div class="flex-1">
            <p class="font-medium text-red-800 dark:text-red-300">이 게시물은 삭제되었습니다.</p>
            {#if formattedDate || deletedBy}
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {#if deletedBy}삭제자: {deletedBy}{/if}
                    {#if deletedBy && formattedDate}
                        ·
                    {/if}
                    {#if formattedDate}삭제일: {formattedDate}{/if}
                </p>
            {/if}
        </div>
    </div>
</div>

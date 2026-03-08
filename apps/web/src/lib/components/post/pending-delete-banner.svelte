<script lang="ts">
    import Clock from '@lucide/svelte/icons/clock';
    import X from '@lucide/svelte/icons/x';
    import { Button } from '$lib/components/ui/button/index.js';

    interface Props {
        scheduledAt: string;
        delayMinutes: number;
        replyCount?: number;
        isComment?: boolean;
        onCancel?: () => Promise<void> | void;
        canCancel?: boolean;
    }

    let {
        scheduledAt,
        delayMinutes,
        replyCount,
        isComment = false,
        onCancel,
        canCancel = true
    }: Props = $props();

    let isCancelling = $state(false);
    let remainingText = $state('');

    function updateRemaining() {
        const now = new Date();
        const target = new Date(scheduledAt);
        const diff = target.getTime() - now.getTime();

        if (diff <= 0) {
            remainingText = '곧 삭제됩니다';
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        if (minutes > 60) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            remainingText = `${hours}시간 ${mins}분 후 삭제`;
        } else if (minutes > 0) {
            remainingText = `${minutes}분 ${seconds}초 후 삭제`;
        } else {
            remainingText = `${seconds}초 후 삭제`;
        }
    }

    $effect(() => {
        updateRemaining();
        const interval = setInterval(updateRemaining, 1000);
        return () => clearInterval(interval);
    });

    async function handleCancel() {
        if (!onCancel || isCancelling) return;
        isCancelling = true;
        try {
            await onCancel();
        } finally {
            isCancelling = false;
        }
    }

    const itemLabel = $derived(isComment ? '댓글' : '게시글');
    const countLabel = $derived(isComment ? '답글' : '댓글');
</script>

<div
    class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
    role="alert"
    aria-live="polite"
>
    <div class="flex items-center gap-3">
        <Clock class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div class="flex-1">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
                {remainingText}
            </p>
            <p class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                {countLabel}
                {replyCount ?? 0}개 · 삭제 대기 {delayMinutes}분
            </p>
        </div>
        {#if canCancel && onCancel}
            <Button
                variant="outline"
                size="sm"
                onclick={handleCancel}
                disabled={isCancelling}
                class="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
            >
                <X class="mr-1 h-3.5 w-3.5" />
                {isCancelling ? '취소 중...' : '삭제 취소'}
            </Button>
        {/if}
    </div>
</div>

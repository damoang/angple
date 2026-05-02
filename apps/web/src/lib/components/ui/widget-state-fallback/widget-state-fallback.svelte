<script lang="ts">
    /**
     * WidgetStateFallback — 위젯 error 상태 표준 fallback UI
     *
     * 모든 위젯이 동일한 retry UX 를 제공하도록 표준화 (audit 2026-05-01 §5-B / P2-B).
     *
     * 사용 예:
     *
     *   <WidgetStateFallback message={machine.state.message} onRetry={() => machine.retry()} />
     *
     * compact 모드는 사이드바처럼 좁은 공간에서 단일 줄로 표시.
     */
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import AlertCircle from '@lucide/svelte/icons/alert-circle';

    interface Props {
        /** 사용자에게 노출할 에러 메시지. */
        message?: string | null;
        /** 재시도 버튼 콜백. 없으면 버튼 미표시. */
        onRetry?: (() => void | Promise<void>) | null;
        /** 좁은 영역(사이드바)용 컴팩트 레이아웃. */
        compact?: boolean;
        /** 재시도 진행 중 (외부 머신의 status === 'loading'). */
        retrying?: boolean;
        /** 컨테이너 추가 클래스. */
        class?: string;
    }

    let {
        message = '데이터를 불러오지 못했어요.',
        onRetry = null,
        compact = false,
        retrying = false,
        class: className = ''
    }: Props = $props();

    async function handleClick() {
        if (!onRetry || retrying) return;
        await onRetry();
    }
</script>

{#if compact}
    <div
        class="text-muted-foreground flex items-center justify-between gap-2 py-2 text-xs {className}"
        role="alert"
    >
        <span class="flex min-w-0 items-center gap-1.5">
            <AlertCircle class="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span class="truncate">{message}</span>
        </span>
        {#if onRetry}
            <button
                type="button"
                onclick={handleClick}
                disabled={retrying}
                class="text-primary hover:bg-muted flex shrink-0 items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors disabled:opacity-50"
                aria-label="다시 불러오기"
            >
                <RefreshCw class="h-3 w-3 {retrying ? 'animate-spin' : ''}" />
                <span>다시</span>
            </button>
        {/if}
    </div>
{:else}
    <div
        class="text-muted-foreground flex flex-col items-center justify-center gap-3 py-6 text-center text-sm {className}"
        role="alert"
    >
        <AlertCircle class="h-6 w-6 text-amber-500" />
        <p>{message}</p>
        {#if onRetry}
            <button
                type="button"
                onclick={handleClick}
                disabled={retrying}
                class="bg-muted hover:bg-muted/80 text-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                aria-label="다시 불러오기"
            >
                <RefreshCw class="h-3.5 w-3.5 {retrying ? 'animate-spin' : ''}" />
                다시 불러오기
            </button>
        {/if}
    </div>
{/if}

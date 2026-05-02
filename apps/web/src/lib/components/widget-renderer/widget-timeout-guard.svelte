<script lang="ts">
    /**
     * 위젯 공통 timeout watchdog (P2-A, audit §5-C)
     *
     * 위젯이 자체 fetch timeout 을 누락했을 때 마지막 안전망으로 작동.
     * 일정 시간(기본 15초) 내에 `ready` 가 true 로 전환되지 않으면
     * 자식 컨텐츠를 숨기고 공통 error fallback UI 를 표시한다.
     *
     * **Opt-in only** — 명시적으로 사용한 위젯에만 적용된다.
     * `widget-wrapper` 에 강제 적용하지 않아 회귀 위험을 최소화한다.
     *
     * 사용 예:
     * ```svelte
     * <WidgetTimeoutGuard ready={!loading} ariaLabel="추천 위젯">
     *   <RecommendedList ... />
     * </WidgetTimeoutGuard>
     * ```
     *
     * 주의:
     * - 위젯 자체 fetch 가 정상 3-10s 범위라면 false-positive 가 발생하지 않도록
     *   기본값 15s 이상 보수적으로 잡는다.
     * - SSR/CSR 모두 안전. 타이머는 `onMount` 에서만 시작 (브라우저 한정).
     * - `ready` 가 timeout 이후 true 로 바뀌면 즉시 fallback 을 해제한다 (지연 데이터 허용).
     */
    import { onDestroy, onMount, type Snippet } from 'svelte';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';

    interface Props {
        /** 자식 컨텐츠 */
        children: Snippet;
        /**
         * 위젯이 정상 로드되었는지 여부.
         * `true` 가 되면 watchdog 은 더 이상 fallback 으로 전환하지 않는다.
         * 호출하는 위젯이 `loading` / `error` 상태를 명시적으로 알려야 한다.
         */
        ready?: boolean;
        /**
         * 명시적 에러 신호 — 즉시 fallback 으로 전환.
         * (예: 위젯 내부에서 fetch 실패를 감지했지만 자체 UI 가 없을 때)
         */
        errored?: boolean;
        /** timeout (ms). 기본 15000. 0/음수면 watchdog 비활성. */
        timeoutMs?: number;
        /**
         * 사용자가 retry 버튼 클릭 시 호출되는 콜백.
         * 미지정 시 `location.reload()` 로 fallback (보수적).
         */
        onRetry?: () => void;
        /** fallback UI 의 aria-label / 위젯 이름 (접근성) */
        ariaLabel?: string;
        /** fallback 영역의 최소 높이 (CLS 방지). 기본 'min-h-[120px]' */
        minHeightClass?: string;
    }

    const {
        children,
        ready,
        errored = false,
        timeoutMs = 15_000,
        onRetry,
        ariaLabel = '위젯',
        minHeightClass = 'min-h-[120px]'
    }: Props = $props();

    let timedOut = $state(false);
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearTimer() {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function startTimer() {
        clearTimer();
        if (!timeoutMs || timeoutMs <= 0) return;
        timer = setTimeout(() => {
            // ready 가 아직 true 가 아닐 때만 fallback 으로 전환
            if (ready !== true) {
                timedOut = true;
            }
            timer = null;
        }, timeoutMs);
    }

    onMount(() => {
        // ready 가 처음부터 true 면 watchdog 불필요
        if (ready === true) return;
        startTimer();
    });

    // ready 가 늦게라도 true 가 되면 fallback 해제 (지연 데이터 허용)
    $effect(() => {
        if (ready === true && timedOut) {
            timedOut = false;
            clearTimer();
        }
    });

    onDestroy(() => {
        clearTimer();
    });

    function handleRetry() {
        timedOut = false;
        if (onRetry) {
            onRetry();
            // retry 시 watchdog 재시작 (위젯이 다시 fetch 하는 동안)
            startTimer();
        } else if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }

    const showFallback = $derived(errored || timedOut);
</script>

{#if showFallback}
    <div
        role="alert"
        aria-label="{ariaLabel} 로드 실패"
        class="border-border bg-muted/30 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center text-sm {minHeightClass}"
    >
        <p>위젯을 불러오지 못했습니다.</p>
        <button
            type="button"
            onclick={handleRetry}
            class="border-border hover:bg-accent inline-flex items-center gap-1 rounded border px-3 py-1 text-xs transition-colors"
        >
            <RefreshCw class="h-3 w-3" />
            다시 불러오기
        </button>
    </div>
{:else}
    {@render children()}
{/if}

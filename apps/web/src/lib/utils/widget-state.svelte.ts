/**
 * widget-state — 위젯 fetch 표준 상태 머신 (audit 2026-05-01 §5-B / P2-B)
 *
 * 모든 위젯이 동일한 상태 모델을 공유하도록 한다:
 *
 *     idle → loading → success | empty | error
 *                              ↑          ↓ retry
 *                              └──────────┘
 *
 * - `idle`: 초기 상태 (아직 load 가 한 번도 호출되지 않음)
 * - `loading`: fetch 진행 중. skeleton 노출.
 * - `success`: 정상 데이터 수신. `data` 가 채워져 있음.
 * - `empty`: fetch 는 성공했으나 데이터가 비어있음 (서버 정상 응답 + 0건).
 * - `error`: fetch 실패 (timeout/network/http). retry 액션을 노출해야 함.
 *
 * Svelte 5 Rune 모드에서 동작하도록 `$state` 객체 형태로 노출하고, 헬퍼는
 * 머신 인스턴스(`createWidgetState`) 가 내부에서 직접 상태를 mutate 한다.
 *
 * 사용 예:
 *
 * ```svelte
 * <script lang="ts">
 *   const machine = createWidgetState<MyDto>({
 *     fetcher: async (signal) => {
 *       const res = await timedFetch('/api/foo', { signal });
 *       return await res.json();
 *     },
 *     isEmpty: (data) => !data?.items?.length
 *   });
 *
 *   onMount(() => machine.load());
 * </script>
 *
 * {#if machine.state.status === 'loading' || machine.state.status === 'idle'}
 *   <Skeleton />
 * {:else if machine.state.status === 'error'}
 *   <WidgetStateFallback message={machine.state.message} onRetry={() => machine.retry()} />
 * {:else if machine.state.status === 'empty'}
 *   <p>데이터가 없습니다.</p>
 * {:else}
 *   ...
 * {/if}
 * ```
 */

export type WidgetStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface WidgetStateValue<T> {
    status: WidgetStatus;
    data: T | null;
    /** error 상태에서 사용자에게 노출할 메시지. */
    message: string | null;
    /** 시도 횟수 (load + retry). 디버깅 / Dantry 송신용. */
    attempts: number;
}

export interface WidgetStateOptions<T> {
    /**
     * 실제 데이터를 가져오는 함수. `signal` 은 reset/load 호출 시 자동으로 abort 된다.
     * timedFetch 와 함께 쓰는 경우 `timedFetch(url, { signal }, { signal })` 형태로 전달.
     */
    fetcher: (signal: AbortSignal) => Promise<T>;
    /** 성공한 응답이 비어있는지 판정. true 면 status='empty'. 기본 false (항상 success). */
    isEmpty?: (data: T) => boolean;
    /** 초기 데이터 (SSR prefetch). 있으면 status='success' 또는 'empty' 로 시작. */
    initialData?: T | null;
    /** error 상태로 진입할 때 사용자 메시지. 기본 "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." */
    errorMessage?: string;
    /** error / success 진입 시 호출되는 hook (Dantry 등). */
    onError?: (err: unknown, attempts: number) => void;
    onSuccess?: (data: T) => void;
}

const DEFAULT_ERROR_MESSAGE = '데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

export interface WidgetStateMachine<T> {
    /** 현재 상태 (Svelte $state). 컴포넌트 템플릿에서 `machine.state.status` 처럼 사용. */
    readonly state: WidgetStateValue<T>;
    /** fetch 시작. 이미 loading 이면 no-op. */
    load: () => Promise<void>;
    /** error 상태에서 재시도. 그 외 상태에서는 load() 와 동일하게 동작. */
    retry: () => Promise<void>;
    /** idle 로 초기화 (진행 중 fetch 는 abort). */
    reset: () => void;
}

/**
 * WidgetState 머신을 생성한다. Svelte 5 Rune 컴포넌트의 `<script>` 최상단에서 한 번 호출.
 */
export function createWidgetState<T>(opts: WidgetStateOptions<T>): WidgetStateMachine<T> {
    const isEmpty = opts.isEmpty ?? (() => false);
    const errorMessage = opts.errorMessage ?? DEFAULT_ERROR_MESSAGE;

    // initialData 기반 초기 상태 결정.
    let initialStatus: WidgetStatus = 'idle';
    let initialDataValue: T | null = opts.initialData ?? null;
    if (opts.initialData !== undefined && opts.initialData !== null) {
        initialStatus = isEmpty(opts.initialData) ? 'empty' : 'success';
    }

    const state: WidgetStateValue<T> = $state({
        status: initialStatus,
        data: initialDataValue,
        message: null,
        attempts: 0
    });

    let controller: AbortController | null = null;

    async function run(): Promise<void> {
        // 진행 중인 fetch 가 있으면 abort.
        if (controller) {
            controller.abort();
        }
        controller = new AbortController();
        const signal = controller.signal;

        state.status = 'loading';
        state.message = null;
        state.attempts += 1;

        try {
            const data = await opts.fetcher(signal);
            if (signal.aborted) return; // 다음 호출이 이미 시작됨

            state.data = data;
            if (isEmpty(data)) {
                state.status = 'empty';
            } else {
                state.status = 'success';
                opts.onSuccess?.(data);
            }
        } catch (err) {
            if (signal.aborted) return; // reset/재호출로 인한 abort 는 상태 갱신 안 함
            state.status = 'error';
            state.message = errorMessage;
            opts.onError?.(err, state.attempts);
        } finally {
            if (controller && controller.signal === signal) {
                controller = null;
            }
        }
    }

    return {
        state,
        load: async () => {
            if (state.status === 'loading') return;
            await run();
        },
        retry: async () => {
            await run();
        },
        reset: () => {
            if (controller) {
                controller.abort();
                controller = null;
            }
            state.status = 'idle';
            state.data = null;
            state.message = null;
            state.attempts = 0;
        }
    };
}

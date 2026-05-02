/**
 * timed-fetch — fetch + AbortController + timeout + 1회 retry + 에러 분류
 *
 * 위젯 / 광고 / 사이드바 컴포넌트에서 fetch 가 hang 했을 때 skeleton 이 영구적으로 남는
 * 안티패턴 (2026-05-01 widget audit) 을 제거하기 위한 표준 유틸.
 *
 * 호출 측은 throw 된 `TimedFetchError` 의 `kind` 로 사용자 메시지를 분기할 수 있다:
 *   - 'timeout'  : controller.abort() 로 인한 AbortError
 *   - 'network'  : 그 외 fetch reject (DNS, offline, CORS 등)
 *   - 'http'     : !res.ok && throwOnHTTPError === true
 *   - 'aborted'  : 호출 측이 외부 signal 로 abort
 */

export interface TimedFetchOptions {
    /** abort 까지 허용하는 ms. 기본 12_000. */
    timeout?: number;
    /** 실패 시 추가 시도 횟수 (timeout/network 만 재시도, http 는 재시도 안 함). 기본 1. */
    retries?: number;
    /** 재시도 사이 지연 ms. 기본 800. */
    retryDelay?: number;
    /** !res.ok 일 때 TimedFetchError('http') 를 throw 할지. 기본 false. */
    throwOnHTTPError?: boolean;
    /** 호출 측에서 외부 abort 신호를 주입하고 싶을 때. */
    signal?: AbortSignal;
}

export type TimedFetchErrorKind = 'timeout' | 'network' | 'http' | 'aborted';

export class TimedFetchError extends Error {
    readonly kind: TimedFetchErrorKind;
    readonly status?: number;
    readonly cause?: unknown;

    constructor(
        kind: TimedFetchErrorKind,
        message: string,
        opts: { status?: number; cause?: unknown } = {}
    ) {
        super(message);
        this.name = 'TimedFetchError';
        this.kind = kind;
        this.status = opts.status;
        this.cause = opts.cause;
    }
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `fetch` 를 timeout 과 1회 retry 로 감싼 안전한 호출.
 *
 * 외부 abort 신호가 먼저 발화되면 더 이상 retry 하지 않고 'aborted' 로 즉시 throw.
 */
export async function timedFetch(
    url: string,
    init: RequestInit = {},
    opts: TimedFetchOptions = {}
): Promise<Response> {
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
    const retries = Math.max(0, opts.retries ?? DEFAULT_RETRIES);
    const retryDelay = opts.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
    const throwOnHTTPError = opts.throwOnHTTPError ?? false;
    const externalSignal = opts.signal;

    let lastError: TimedFetchError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        if (externalSignal?.aborted) {
            throw new TimedFetchError('aborted', '호출 측에서 abort 됨');
        }

        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);

        const onExternalAbort = () => controller.abort();
        externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

        try {
            const res = await fetch(url, { ...init, signal: controller.signal });

            if (throwOnHTTPError && !res.ok) {
                throw new TimedFetchError('http', `HTTP ${res.status}`, { status: res.status });
            }

            return res;
        } catch (err) {
            if (err instanceof TimedFetchError && err.kind === 'http') {
                // HTTP 4xx/5xx 는 재시도 안 함 — 즉시 전파.
                throw err;
            }

            if (externalSignal?.aborted && !timedOut) {
                throw new TimedFetchError('aborted', '호출 측에서 abort 됨', { cause: err });
            }

            const kind: TimedFetchErrorKind = timedOut ? 'timeout' : 'network';
            lastError = new TimedFetchError(
                kind,
                kind === 'timeout' ? `요청 시간 초과 (${timeout}ms)` : '네트워크 오류',
                { cause: err }
            );

            if (attempt < retries) {
                await delay(retryDelay);
                continue;
            }
            throw lastError;
        } finally {
            clearTimeout(timer);
            externalSignal?.removeEventListener('abort', onExternalAbort);
        }
    }

    // 도달 불가 — 안전망
    throw lastError ?? new TimedFetchError('network', 'unknown');
}

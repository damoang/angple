/**
 * API 재시도 및 타임아웃 유틸리티
 */

import { ApiRequestError } from './errors';

export interface RetryConfig {
    /** 최대 재시도 횟수 (기본: 2) */
    maxRetries: number;
    /** 기본 대기 시간 ms (기본: 1000) */
    baseDelay: number;
    /** 요청 타임아웃 ms (기본: 15000) */
    timeout: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 1,
    baseDelay: 500,
    timeout: 8000
};

/** 지수 백오프 딜레이 계산 */
function getDelay(attempt: number, baseDelay: number): number {
    // 지수 백오프 + 지터 (0~500ms)
    return baseDelay * Math.pow(2, attempt) + Math.random() * 500;
}

/** 타임아웃이 적용된 fetch
 *
 * 외부 `options.signal` 이 들어오면 내부 timeout controller 와 합성한다.
 * - 외부 abort → 내부 fetch 도 즉시 abort (호출 측 'aborted' 처리)
 * - 내부 timeout → 외부 호출 측 abort 와 무관 (timeout 전파)
 *
 * 이 합성은 P0 leak fix (2026-05-02): 호출 측이 widget unmount 등으로
 * abort 하면 underlying fetch closure 가 즉시 정리된다 (Promise.race 가
 * timeout reject 후에도 fetch promise 가 살아남던 패턴 제거).
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    fetchFn: typeof fetch = fetch
): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = options.signal as AbortSignal | undefined;

    // 외부 signal 이 이미 abort 상태면 즉시 종료
    if (externalSignal?.aborted) {
        throw ApiRequestError.aborted();
    }

    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        // signal 은 합성된 controller.signal 을 사용 (외부 옵션 signal 은 위에서 listener 로 위임)
        const { signal: _ignore, ...rest } = options;
        const response = await fetchFn(url, {
            ...rest,
            signal: controller.signal
        });
        return response;
    } catch (error) {
        // AbortError: DOMException (브라우저) 또는 name='AbortError' Error (테스트/일부 런타임)
        const isAbort =
            (error instanceof DOMException && error.name === 'AbortError') ||
            (error instanceof Error && error.name === 'AbortError') ||
            controller.signal.aborted;
        if (isAbort) {
            if (timedOut) throw ApiRequestError.timeout();
            // 외부 abort — retry 금지
            throw ApiRequestError.aborted();
        }
        throw ApiRequestError.network();
    } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onExternalAbort);
    }
}

/** 재시도 가능한 fetch 래퍼 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    fetchFn: typeof fetch = fetch
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options, config.timeout, fetchFn);

            // 재시도 가능한 서버 에러인 경우
            if (response.status >= 500 && attempt < config.maxRetries) {
                lastError = ApiRequestError.fromStatus(response.status);
                await sleep(getDelay(attempt, config.baseDelay));
                continue;
            }

            // 429 Rate Limit — 재시도하면 오히려 요청량 증가시키므로 즉시 반환
            if (response.status === 429) {
                return response;
            }

            return response;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // 네트워크/타임아웃 에러는 재시도
            if (
                error instanceof ApiRequestError &&
                error.retryable &&
                attempt < config.maxRetries
            ) {
                await sleep(getDelay(attempt, config.baseDelay));
                continue;
            }

            throw error;
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

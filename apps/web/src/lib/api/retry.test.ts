/**
 * retry.ts AbortSignal composition 테스트
 *
 * P0 leak fix (2026-05-02) 검증:
 *  - 외부 signal abort 시 underlying fetch 도 즉시 abort (closure 정리)
 *  - aborted 에러는 retryable=false → 재시도 안 함
 *  - 내부 timeout 은 별개 경로
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, fetchWithRetry } from './retry';
import { ApiRequestError } from './errors';

describe('fetchWithTimeout — AbortSignal composition', () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.fetch = realFetch;
        vi.restoreAllMocks();
    });

    it('외부 signal 이 이미 abort → 즉시 ApiRequestError(aborted)', async () => {
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;

        const ctrl = new AbortController();
        ctrl.abort();

        let caught: unknown;
        try {
            await fetchWithTimeout('/api/x', { signal: ctrl.signal }, 5000);
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(ApiRequestError);
        expect((caught as ApiRequestError).type).toBe('aborted');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('외부 signal 이 도중에 abort → underlying fetch 도 abort, aborted 에러', async () => {
        let innerSignal: AbortSignal | undefined;
        globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
            innerSignal = init.signal as AbortSignal;
            return new Promise((_resolve, reject) => {
                innerSignal?.addEventListener('abort', () => {
                    const e = new Error('aborted');
                    e.name = 'AbortError';
                    reject(e);
                });
            });
        });

        const ctrl = new AbortController();
        const promise = fetchWithTimeout('/api/x', { signal: ctrl.signal }, 10_000);
        promise.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(0);
        ctrl.abort();
        await vi.advanceTimersByTimeAsync(10);

        let caught: unknown;
        try {
            await promise;
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(ApiRequestError);
        expect((caught as ApiRequestError).type).toBe('aborted');
        // underlying fetch 의 signal 도 abort 됐는지 확인 (closure 정리 보장)
        expect(innerSignal?.aborted).toBe(true);
    });

    it('내부 timeout — ApiRequestError(timeout)', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => {
                    const e = new Error('aborted');
                    e.name = 'AbortError';
                    reject(e);
                });
            });
        });

        const promise = fetchWithTimeout('/api/x', {}, 100);
        promise.catch(() => undefined);
        await vi.advanceTimersByTimeAsync(150);

        let caught: unknown;
        try {
            await promise;
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(ApiRequestError);
        expect((caught as ApiRequestError).type).toBe('timeout');
    });

    it('정상 응답 — 외부 signal abort 리스너 정리', async () => {
        const ok = new Response('{}', { status: 200 });
        globalThis.fetch = vi.fn().mockResolvedValue(ok);

        const ctrl = new AbortController();
        const removeSpy = vi.spyOn(ctrl.signal, 'removeEventListener');

        const res = await fetchWithTimeout('/api/x', { signal: ctrl.signal }, 5000);
        expect(res.status).toBe(200);
        expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });
});

describe('fetchWithRetry — aborted 는 재시도 금지', () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.fetch = realFetch;
        vi.restoreAllMocks();
    });

    it('외부 abort → 재시도 없이 ApiRequestError(aborted) 1회만', async () => {
        const fetchSpy = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => {
                    const e = new Error('aborted');
                    e.name = 'AbortError';
                    reject(e);
                });
            });
        });
        globalThis.fetch = fetchSpy;

        const ctrl = new AbortController();
        const promise = fetchWithRetry(
            '/api/x',
            { signal: ctrl.signal },
            { maxRetries: 3, baseDelay: 10, timeout: 10_000 }
        );
        promise.catch(() => undefined);

        // microtask flush (fetch promise 진입) 후 abort
        await vi.advanceTimersByTimeAsync(0);
        ctrl.abort();
        await vi.advanceTimersByTimeAsync(50);

        let caught: unknown;
        try {
            await promise;
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(ApiRequestError);
        expect((caught as ApiRequestError).type).toBe('aborted');
        // 재시도 없이 정확히 1번만 호출
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});

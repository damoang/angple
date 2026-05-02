/**
 * timed-fetch.ts 테스트
 * - 정상 응답
 * - 타임아웃 abort
 * - 외부 signal abort
 * - retry 1회 동작 후 정상
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimedFetchError, timedFetch } from './timed-fetch';

describe('timedFetch', () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.fetch = realFetch;
        vi.restoreAllMocks();
    });

    it('정상 응답 — 한 번에 통과', async () => {
        const ok = new Response('{"ok":true}', { status: 200 });
        globalThis.fetch = vi.fn().mockResolvedValue(ok);

        const res = await timedFetch('/api/test', {}, { timeout: 5000, retries: 0 });

        expect(res.status).toBe(200);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('타임아웃 — controller.abort() 후 TimedFetchError(kind=timeout)', async () => {
        // fetch 가 영원히 pending 인 시나리오. signal.aborted === true 가 되면 reject.
        globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => {
                    const e = new Error('aborted');
                    e.name = 'AbortError';
                    reject(e);
                });
            });
        });

        const promise = timedFetch('/api/test', {}, { timeout: 100, retries: 0 });
        // 미처리 rejection 경고 방지 (실제 검증은 try/catch 로)
        promise.catch(() => undefined);

        // timer 발화 → abort → reject
        await vi.advanceTimersByTimeAsync(150);

        let caught: unknown;
        try {
            await promise;
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(TimedFetchError);
        expect((caught as TimedFetchError).kind).toBe('timeout');
    });

    it('외부 signal abort — TimedFetchError(kind=aborted) + retry 안 함', async () => {
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

        const external = new AbortController();
        const promise = timedFetch(
            '/api/test',
            {},
            { timeout: 10_000, retries: 3, signal: external.signal }
        );
        promise.catch(() => undefined);

        // 외부 abort 트리거
        external.abort();
        await vi.advanceTimersByTimeAsync(0);

        let caught: unknown;
        try {
            await promise;
        } catch (e) {
            caught = e;
        }
        expect((caught as TimedFetchError).kind).toBe('aborted');
        // 외부 abort 후에는 추가 retry 가 일어나지 않아야 함.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('retry — 첫 시도 네트워크 실패, 두 번째 시도 성공', async () => {
        const ok = new Response('ok', { status: 200 });
        const fetchSpy = vi
            .fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(ok);
        globalThis.fetch = fetchSpy;

        const promise = timedFetch('/api/test', {}, { timeout: 5000, retries: 1, retryDelay: 200 });

        // retry delay 통과
        await vi.advanceTimersByTimeAsync(250);

        const res = await promise;
        expect(res.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('retry 소진 — 마지막 에러 throw', async () => {
        const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        globalThis.fetch = fetchSpy;

        const promise = timedFetch('/api/test', {}, { timeout: 5000, retries: 1, retryDelay: 50 });
        promise.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(100);

        let caught: unknown;
        try {
            await promise;
        } catch (e) {
            caught = e;
        }
        expect((caught as TimedFetchError).kind).toBe('network');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('throwOnHTTPError — 4xx/5xx 는 즉시 throw + retry 안 함', async () => {
        const bad = new Response('err', { status: 503 });
        const fetchSpy = vi.fn().mockResolvedValue(bad);
        globalThis.fetch = fetchSpy;

        const promise = timedFetch(
            '/api/test',
            {},
            { timeout: 5000, retries: 3, throwOnHTTPError: true }
        );

        await expect(promise).rejects.toMatchObject({ kind: 'http', status: 503 });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});

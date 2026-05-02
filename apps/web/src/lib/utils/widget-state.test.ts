/**
 * widget-state 테스트
 *
 * 검증 기준 (audit P2-B Sprint Contract):
 * 1. 초기 상태: idle (initialData 없음)
 * 2. initialData 가 비어있지 않으면 success 로 시작
 * 3. initialData + isEmpty=true 면 empty 로 시작
 * 4. load() 성공 → loading → success 전이
 * 5. load() 실패 → loading → error 전이 + message 채움
 * 6. retry() 가 error 상태에서 재시도하여 success 진입
 * 7. reset() 이 idle 로 되돌리고 진행 중 fetch 를 abort
 * 8. isEmpty 가 true 인 응답은 success 가 아닌 empty
 * 9. 동시 load() 호출 시 중복 fetch 안 함 (loading 중 noop)
 * 10. attempts 카운터 정확
 */

import { describe, it, expect, vi } from 'vitest';
import { createWidgetState } from './widget-state.svelte';

// AbortSignal 을 받는 fetcher 가 abort 됐는지 확인할 수 있도록 helper.
function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('createWidgetState', () => {
    it('1. 초기 상태: initialData 없으면 idle', () => {
        const m = createWidgetState({
            fetcher: async () => ({ items: [] })
        });
        expect(m.state.status).toBe('idle');
        expect(m.state.data).toBeNull();
        expect(m.state.attempts).toBe(0);
    });

    it('2. initialData 가 채워져 있으면 success 로 시작', () => {
        const m = createWidgetState({
            fetcher: async () => ({ items: [1] }),
            initialData: { items: [1, 2] },
            isEmpty: (d) => !d.items.length
        });
        expect(m.state.status).toBe('success');
        expect(m.state.data).toEqual({ items: [1, 2] });
    });

    it('3. initialData + isEmpty=true 면 empty 로 시작', () => {
        const m = createWidgetState({
            fetcher: async () => ({ items: [] }),
            initialData: { items: [] },
            isEmpty: (d) => !d.items.length
        });
        expect(m.state.status).toBe('empty');
    });

    it('4. load() 성공 → loading → success 전이', async () => {
        const d = deferred<{ items: number[] }>();
        const m = createWidgetState({
            fetcher: () => d.promise
        });

        const loadPromise = m.load();
        // 마이크로태스크 한 번 양보 → loading 진입 확인
        await Promise.resolve();
        expect(m.state.status).toBe('loading');
        expect(m.state.attempts).toBe(1);

        d.resolve({ items: [1, 2, 3] });
        await loadPromise;

        expect(m.state.status).toBe('success');
        expect(m.state.data).toEqual({ items: [1, 2, 3] });
        expect(m.state.message).toBeNull();
    });

    it('5. load() 실패 → loading → error 전이 + message 채움', async () => {
        const onError = vi.fn();
        const m = createWidgetState({
            fetcher: async () => {
                throw new Error('boom');
            },
            errorMessage: '실패했어요',
            onError
        });

        await m.load();

        expect(m.state.status).toBe('error');
        expect(m.state.message).toBe('실패했어요');
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('6. retry() 가 error 상태에서 재시도하여 success 진입', async () => {
        let attempt = 0;
        const m = createWidgetState({
            fetcher: async () => {
                attempt += 1;
                if (attempt === 1) throw new Error('first fails');
                return { ok: true };
            }
        });

        await m.load();
        expect(m.state.status).toBe('error');
        expect(m.state.attempts).toBe(1);

        await m.retry();
        expect(m.state.status).toBe('success');
        expect(m.state.attempts).toBe(2);
        expect(m.state.data).toEqual({ ok: true });
    });

    it('7. reset() 이 idle 로 되돌리고 진행 중 fetch 를 abort', async () => {
        const d = deferred<unknown>();
        let abortedFlag = false;
        const m = createWidgetState({
            fetcher: (signal) => {
                signal.addEventListener('abort', () => {
                    abortedFlag = true;
                });
                return d.promise;
            }
        });

        const p = m.load();
        await Promise.resolve();
        expect(m.state.status).toBe('loading');

        m.reset();
        expect(m.state.status).toBe('idle');
        expect(m.state.data).toBeNull();
        expect(m.state.attempts).toBe(0);
        expect(abortedFlag).toBe(true);

        // 원래 fetch 가 뒤늦게 resolve 해도 상태가 흔들리지 않는다.
        d.resolve({ items: [99] });
        await p;
        expect(m.state.status).toBe('idle');
    });

    it('8. isEmpty 가 true 인 응답은 empty 상태', async () => {
        const m = createWidgetState({
            fetcher: async () => ({ items: [] }),
            isEmpty: (d) => !d.items.length
        });

        await m.load();
        expect(m.state.status).toBe('empty');
        expect(m.state.data).toEqual({ items: [] });
    });

    it('9. loading 중 추가 load() 는 noop', async () => {
        const d = deferred<{ ok: boolean }>();
        let calls = 0;
        const m = createWidgetState({
            fetcher: () => {
                calls += 1;
                return d.promise;
            }
        });

        const p1 = m.load();
        await Promise.resolve();
        expect(m.state.status).toBe('loading');

        // loading 중 두 번째 load 는 즉시 종료 (run 호출 안 함)
        await m.load();
        expect(calls).toBe(1);
        expect(m.state.attempts).toBe(1);

        d.resolve({ ok: true });
        await p1;
        expect(m.state.status).toBe('success');
    });

    it('10. retry() 는 success 후에도 다시 실행', async () => {
        let attempt = 0;
        const m = createWidgetState({
            fetcher: async () => {
                attempt += 1;
                return { value: attempt };
            }
        });

        await m.load();
        expect(m.state.data).toEqual({ value: 1 });
        await m.retry();
        expect(m.state.data).toEqual({ value: 2 });
        expect(m.state.attempts).toBe(2);
    });

    it('11. abort 후 fetcher 가 throw 해도 상태 갱신 안 함', async () => {
        const d = deferred<unknown>();
        const m = createWidgetState({
            fetcher: (signal) => {
                return new Promise((_, reject) => {
                    signal.addEventListener('abort', () => reject(new Error('aborted')));
                    d.promise.then(reject);
                });
            }
        });

        const p = m.load();
        await Promise.resolve();
        m.reset();
        await p; // 내부에서 swallow 됨
        expect(m.state.status).toBe('idle');
        expect(m.state.message).toBeNull();
    });

    it('12. onSuccess hook 호출', async () => {
        const onSuccess = vi.fn();
        const m = createWidgetState({
            fetcher: async () => ({ k: 1 }),
            onSuccess
        });
        await m.load();
        expect(onSuccess).toHaveBeenCalledWith({ k: 1 });
    });
});

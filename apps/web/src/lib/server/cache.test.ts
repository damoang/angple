import { describe, it, expect, vi } from 'vitest';
import { createCache, TieredCache } from './cache';

// Redis 모듈을 mock — 실제 Redis 없이 TieredCache 의 pending Map 동작만 검증
vi.mock('./redis.js', () => ({
    getRedis: () => {
        throw new Error('redis disabled in test');
    }
}));

describe('createCache', () => {
    it('set/get 동작', () => {
        const cache = createCache<string>({ ttl: 10_000 });
        cache.set('a', 'hello');
        expect(cache.get('a')).toBe('hello');
    });

    it('만료된 항목 반환 안함', () => {
        vi.useFakeTimers();
        const cache = createCache<string>({ ttl: 100 });
        cache.set('a', 'hello');
        vi.advanceTimersByTime(200);
        expect(cache.get('a')).toBeUndefined();
        vi.useRealTimers();
    });

    it('getOrSet factory 호출', async () => {
        const cache = createCache<number>({ ttl: 10_000 });
        const factory = vi.fn().mockResolvedValue(42);

        const val1 = await cache.getOrSet('x', factory);
        expect(val1).toBe(42);
        expect(factory).toHaveBeenCalledTimes(1);

        // 캐시 히트 시 factory 미호출
        const val2 = await cache.getOrSet('x', factory);
        expect(val2).toBe(42);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('maxSize 초과 시 오래된 항목 제거', () => {
        const cache = createCache<number>({ ttl: 10_000, maxSize: 2 });
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3); // 'a' 제거됨
        expect(cache.get('a')).toBeUndefined();
        expect(cache.get('c')).toBe(3);
    });

    it('delete/clear', () => {
        const cache = createCache<string>({ ttl: 10_000 });
        cache.set('a', '1');
        cache.set('b', '2');
        cache.delete('a');
        expect(cache.get('a')).toBeUndefined();
        expect(cache.size()).toBe(1);
        cache.clear();
        expect(cache.size()).toBe(0);
    });
});

describe('TieredCache pending leak protection', () => {
    it('factory resolve 시 pending entry 정리 + timer cleanup', async () => {
        const cache = new TieredCache<number>('t1', 10_000, 60, 100, 5_000, 1_000);
        const result = await cache.getOrFetch('k1', async () => 42);
        expect(result).toBe(42);
        expect(cache.pendingSize()).toBe(0);
        cache.clearPending();
    });

    it('factory reject 시 pending entry 정리', async () => {
        const cache = new TieredCache<number>('t2', 10_000, 60, 100, 5_000, 1_000);
        await expect(
            cache.getOrFetch('k1', async () => {
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');
        expect(cache.pendingSize()).toBe(0);
        cache.clearPending();
    });

    it('factory hang → pendingTimeoutMs 후 reject + entry 제거', async () => {
        const cache = new TieredCache<number>('t3', 10_000, 60, 100, 100, 5_000);

        // 절대 resolve 되지 않는 factory (backend hang 시뮬레이션)
        const promise = cache.getOrFetch('hang', () => new Promise(() => {}));
        // 마이크로태스크 flush 후 pending 등록 확인
        await new Promise((r) => setImmediate(r));
        expect(cache.pendingSize()).toBe(1);

        await expect(promise).rejects.toThrow(/pending timeout/);
        expect(cache.pendingSize()).toBe(0);
        cache.clearPending();
    }, 1_000);

    it('pendingMaxSize 초과 시 oldest entry 제거', async () => {
        const cache = new TieredCache<number>('t4', 10_000, 60, 100, 60_000, 3);

        // 모두 hang 시켜서 pending 에 쌓임. 순차 호출하여 insertion order 보장
        const p1 = cache.getOrFetch('a', () => new Promise(() => {}));
        await new Promise((r) => setImmediate(r));
        const p2 = cache.getOrFetch('b', () => new Promise(() => {}));
        await new Promise((r) => setImmediate(r));
        const p3 = cache.getOrFetch('c', () => new Promise(() => {}));
        await new Promise((r) => setImmediate(r));
        expect(cache.pendingSize()).toBe(3);

        // 4 번째 추가 시 oldest('a') 제거되고 'd' 추가 → size 유지
        const p4 = cache.getOrFetch('d', () => new Promise(() => {}));
        await new Promise((r) => setImmediate(r));
        expect(cache.pendingSize()).toBe(3);

        // unhandled rejection 방지
        p1.catch(() => {});
        p2.catch(() => {});
        p3.catch(() => {});
        p4.catch(() => {});

        cache.clearPending();
    });

    it('동일 key singleflight: factory 1 회만 호출', async () => {
        const cache = new TieredCache<number>('t5', 10_000, 60, 100, 5_000, 1_000);
        let factoryCalls = 0;
        const factory = async () => {
            factoryCalls++;
            await new Promise((r) => setTimeout(r, 5));
            return 7;
        };

        // 첫 호출이 pending Map 에 등록될 때까지 기다린 후 두 번째 호출
        const p1 = cache.getOrFetch('same', factory);
        await new Promise((r) => setImmediate(r));
        const p2 = cache.getOrFetch('same', factory);

        const [a, b] = await Promise.all([p1, p2]);
        expect(a).toBe(7);
        expect(b).toBe(7);
        expect(factoryCalls).toBe(1); // singleflight
        expect(cache.pendingSize()).toBe(0);
        cache.clearPending();
    });

    it('clearPending: 모든 timer cleanup + Map 비움', async () => {
        const cache = new TieredCache<number>('t6', 10_000, 60, 100, 60_000, 5_000);
        const p1 = cache.getOrFetch('a', () => new Promise(() => {}));
        await new Promise((r) => setImmediate(r));
        const p2 = cache.getOrFetch('b', () => new Promise(() => {}));
        await new Promise((r) => setImmediate(r));
        expect(cache.pendingSize()).toBe(2);

        cache.clearPending();
        expect(cache.pendingSize()).toBe(0);

        // pending 이 비워져도 promise 자체는 살아있음 → unhandled 방지
        p1.catch(() => {});
        p2.catch(() => {});
    });
});

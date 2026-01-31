import { describe, it, expect, vi } from 'vitest';
import { createCache } from './cache';

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

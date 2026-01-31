/**
 * 서버 사이드 인메모리 캐시
 *
 * SvelteKit SSR에서 반복 요청을 줄이기 위한 단순한 TTL 기반 캐시입니다.
 * 프로덕션에서는 Redis로 교체하는 것을 권장합니다.
 *
 * @example
 * ```ts
 * const boardCache = createCache<Board>({ ttl: 60_000 }); // 1분
 * const board = await boardCache.getOrSet('free', () => fetchBoard('free'));
 * ```
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

interface CacheOptions {
    /** 캐시 유효 시간 (ms). 기본: 60초 */
    ttl: number;
    /** 최대 항목 수. 기본: 500 */
    maxSize: number;
}

const DEFAULT_OPTIONS: CacheOptions = {
    ttl: 60_000,
    maxSize: 500
};

export interface Cache<T> {
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    getOrSet(key: string, factory: () => Promise<T>): Promise<T>;
    delete(key: string): void;
    clear(): void;
    size(): number;
}

export function createCache<T>(options?: Partial<CacheOptions>): Cache<T> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const store = new Map<string, CacheEntry<T>>();

    function isExpired(entry: CacheEntry<T>): boolean {
        return Date.now() > entry.expiresAt;
    }

    function evictExpired(): void {
        for (const [key, entry] of store) {
            if (isExpired(entry)) store.delete(key);
        }
    }

    return {
        get(key: string): T | undefined {
            const entry = store.get(key);
            if (!entry) return undefined;
            if (isExpired(entry)) {
                store.delete(key);
                return undefined;
            }
            return entry.value;
        },

        set(key: string, value: T): void {
            // LRU 간이 구현: 최대 크기 초과 시 만료된 항목 정리
            if (store.size >= config.maxSize) {
                evictExpired();
                // 여전히 초과면 가장 오래된 항목 제거
                if (store.size >= config.maxSize) {
                    const firstKey = store.keys().next().value;
                    if (firstKey !== undefined) store.delete(firstKey);
                }
            }

            store.set(key, {
                value,
                expiresAt: Date.now() + config.ttl
            });
        },

        async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
            const cached = this.get(key);
            if (cached !== undefined) return cached;

            const value = await factory();
            this.set(key, value);
            return value;
        },

        delete(key: string): void {
            store.delete(key);
        },

        clear(): void {
            store.clear();
        },

        size(): number {
            return store.size;
        }
    };
}

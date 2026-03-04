/**
 * 서버 사이드 캐시 유틸리티
 *
 * 1. createCache<T>() — 단순 인메모리 TTL 캐시
 * 2. TieredCache<T> — L1(Map) → L2(Redis) 2-tier 캐시
 *    - L1 히트: 0ms, L2 히트: 1-3ms, 미스: DB/API 호출
 *    - 서버 재시작 시 Redis에서 복구 (cold start 방지)
 *    - 멀티 인스턴스(K8s pods) 간 캐시 공유
 *
 * @example
 * ```ts
 * const boardCache = createCache<Board>({ ttl: 60_000 }); // 단순 캐시
 * const sessionCache = new TieredCache<Session>('sess', 60_000, 300); // 2-tier
 * ```
 */
import { getRedis } from './redis.js';

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

// --- 2-tier 캐시: L1 (Map) → L2 (Redis) ---

interface L1Entry<T> {
    data: T;
    expiry: number;
}

/**
 * 2-tier 캐시: L1(Map, 0ms) → L2(Redis, 1-3ms)
 *
 * Redis 장애 시 L1만으로 동작 (graceful degradation).
 */
export class TieredCache<T> {
    private l1: Map<string, L1Entry<T>>;
    private readonly prefix: string;
    private readonly l1TtlMs: number;
    private readonly l2TtlSec: number;
    private readonly maxL1Size: number;

    constructor(prefix: string, l1TtlMs: number, l2TtlSec: number, maxL1Size = 5000) {
        this.l1 = new Map();
        this.prefix = prefix;
        this.l1TtlMs = l1TtlMs;
        this.l2TtlSec = l2TtlSec;
        this.maxL1Size = maxL1Size;
    }

    /** L1 → L2 조회 */
    async get(key: string): Promise<T | null> {
        const l1Entry = this.l1.get(key);
        if (l1Entry && Date.now() < l1Entry.expiry) {
            return l1Entry.data;
        }

        try {
            const redis = getRedis();
            const val = await redis.get(`${this.prefix}:${key}`);
            if (val) {
                const data = JSON.parse(val) as T;
                this.setL1(key, data);
                return data;
            }
        } catch {
            // Redis 장애 → null (DB fallback)
        }

        return null;
    }

    /** L1 + L2에 저장 */
    async set(key: string, data: T): Promise<void> {
        this.setL1(key, data);

        try {
            const redis = getRedis();
            await redis.setex(`${this.prefix}:${key}`, this.l2TtlSec, JSON.stringify(data));
        } catch {
            // Redis 장애 무시 (L1에는 있음)
        }
    }

    /** L1 + L2에서 삭제 */
    async delete(key: string): Promise<void> {
        this.l1.delete(key);

        try {
            const redis = getRedis();
            await redis.del(`${this.prefix}:${key}`);
        } catch {
            // Redis 장애 무시
        }
    }

    /** L1 + L2 조회 → 미스 시 factory 실행 후 저장 */
    async getOrFetch(key: string, factory: () => Promise<T>): Promise<T> {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        const data = await factory();
        await this.set(key, data);
        return data;
    }

    /** L1만 삭제 */
    deleteL1(key: string): void {
        this.l1.delete(key);
    }

    /** L1 전체 삭제 */
    clearL1(): void {
        this.l1.clear();
    }

    private setL1(key: string, data: T): void {
        if (this.l1.size >= this.maxL1Size) {
            const now = Date.now();
            for (const [k, entry] of this.l1) {
                if (now >= entry.expiry) this.l1.delete(k);
            }
            if (this.l1.size >= this.maxL1Size) {
                const keys = Array.from(this.l1.keys());
                for (const k of keys.slice(0, Math.floor(keys.length / 2))) {
                    this.l1.delete(k);
                }
            }
        }
        this.l1.set(key, { data, expiry: Date.now() + this.l1TtlMs });
    }
}

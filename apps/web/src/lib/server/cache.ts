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
    /** TTL 만료되어도 stale 데이터 반환 (에러 fallback용) */
    getStale(key: string): T | undefined;
    set(key: string, value: T): void;
    getOrSet(key: string, factory: () => Promise<T>): Promise<T>;
    delete(key: string): void;
    clear(): void;
    size(): number;
}

export function createCache<T>(options?: Partial<CacheOptions>): Cache<T> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const store = new Map<string, CacheEntry<T>>();
    const pending = new Map<string, Promise<T>>();

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

        getStale(key: string): T | undefined {
            const entry = store.get(key);
            return entry?.value;
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

            // Singleflight: 동일 key에 대한 중복 factory 실행 방지
            const inflight = pending.get(key);
            if (inflight) return inflight;

            const promise = factory()
                .then((value) => {
                    this.set(key, value);
                    pending.delete(key);
                    return value;
                })
                .catch((err) => {
                    pending.delete(key);
                    throw err;
                });

            pending.set(key, promise);
            return promise;
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

interface PendingEntry<T> {
    promise: Promise<T>;
    timer: ReturnType<typeof setTimeout>;
    createdAt: number;
}

/** pending Map 의 entry 별 timeout (ms). 외부 fetch 가 hang 해도 closure 가 영원히 retain 되지 않도록 강제 reject */
const PENDING_TIMEOUT_MS = 30_000;

/** pending Map 최대 entry 수. 초과 시 가장 오래된 entry 제거 (LRU-ish) */
const PENDING_MAX_SIZE = 5_000;

/**
 * 2-tier 캐시: L1(Map, 0ms) → L2(Redis, 1-3ms)
 *
 * Redis 장애 시 L1만으로 동작 (graceful degradation).
 *
 * Singleflight (`pending` Map) 은 두 가지 안전 장치를 가짐 (memory leak 방지):
 * 1. Per-entry timeout (PENDING_TIMEOUT_MS): factory 가 hang 하면 강제 reject + entry 제거
 * 2. Map size cap (PENDING_MAX_SIZE): 초과 시 oldest entry timer cleanup 후 제거
 */
export class TieredCache<T> {
    private l1: Map<string, L1Entry<T>>;
    private readonly prefix: string;
    private readonly l1TtlMs: number;
    private readonly l2TtlSec: number;
    private readonly maxL1Size: number;
    private readonly pending: Map<string, PendingEntry<T>>;
    private readonly pendingTimeoutMs: number;
    private readonly pendingMaxSize: number;

    constructor(
        prefix: string,
        l1TtlMs: number,
        l2TtlSec: number,
        maxL1Size = 5000,
        pendingTimeoutMs: number = PENDING_TIMEOUT_MS,
        pendingMaxSize: number = PENDING_MAX_SIZE
    ) {
        this.l1 = new Map();
        this.pending = new Map();
        this.prefix = prefix;
        this.l1TtlMs = l1TtlMs;
        this.l2TtlSec = l2TtlSec;
        this.maxL1Size = maxL1Size;
        this.pendingTimeoutMs = pendingTimeoutMs;
        this.pendingMaxSize = pendingMaxSize;
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
            // Redis 장애 → stale L1 데이터가 있으면 반환 (graceful degradation)
            if (l1Entry) return l1Entry.data;
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

    /** L1 + L2 조회 → 미스 시 factory 실행 후 저장 (singleflight) */
    async getOrFetch(key: string, factory: () => Promise<T>): Promise<T> {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        // Singleflight: 동일 key에 대한 중복 factory 실행 방지
        const inflight = this.pending.get(key);
        if (inflight) return inflight.promise;

        // pending Map size cap — 초과 시 가장 오래된 entry 의 timer cleanup 후 제거
        // Map 은 insertion order 유지하므로 keys().next() 가 oldest
        if (this.pending.size >= this.pendingMaxSize) {
            const oldestKey = this.pending.keys().next().value;
            if (oldestKey !== undefined) {
                const oldest = this.pending.get(oldestKey);
                if (oldest) clearTimeout(oldest.timer);
                this.pending.delete(oldestKey);
            }
        }

        // 외부에서 entry 를 강제 정리할 수 있도록 timer reference 를 미리 만들고 closure 로 전달
        let timer: ReturnType<typeof setTimeout>;
        const cleanup = () => {
            const entry = this.pending.get(key);
            // 같은 promise 인 경우에만 삭제 (덮어쓰여진 경우 새 entry 보존)
            if (entry && entry.promise === promise) {
                clearTimeout(entry.timer);
                this.pending.delete(key);
            }
        };

        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                this.pending.delete(key);
                reject(
                    new Error(
                        `TieredCache[${this.prefix}] pending timeout (${this.pendingTimeoutMs}ms) for key=${key}`
                    )
                );
            }, this.pendingTimeoutMs);
        });

        const factoryPromise = factory().then(async (data) => {
            await this.set(key, data);
            return data;
        });

        // timeout 후 factory 가 reject 되어도 unhandled rejection 이 되지 않도록 catch 부착
        // (factory 결과는 race 에서 이미 무시되므로 silently swallow)
        factoryPromise.catch(() => {});

        // factory 와 timeout 중 먼저 settle 되는 쪽 사용. timeout 발생 시 factory 결과는 무시
        const promise = Promise.race([factoryPromise, timeoutPromise])
            .then((data) => {
                cleanup();
                return data;
            })
            .catch((err) => {
                cleanup();
                throw err;
            });

        this.pending.set(key, { promise, timer: timer!, createdAt: Date.now() });
        return promise;
    }

    /** L1만 삭제 */
    deleteL1(key: string): void {
        this.l1.delete(key);
    }

    /** L1 전체 삭제 */
    clearL1(): void {
        this.l1.clear();
    }

    /** pending Map 크기 (모니터링/테스트 용) */
    pendingSize(): number {
        return this.pending.size;
    }

    /** pending Map 전체 정리 — 모든 timer cleanup. 테스트/shutdown 용 */
    clearPending(): void {
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer);
        }
        this.pending.clear();
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

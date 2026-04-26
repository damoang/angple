/**
 * Bluesky handle → DID resolver (server-only)
 *
 * `bsky.app/profile/<handle>/post/<id>` 임베드는 embed.bsky.app 측에서 DID
 * (`did:plc:...` / `did:web:...`) 만 허용한다. 본문에 들어 있는 handle 을 SSR
 * 단계에서 DID 로 미리 변환해두기 위한 모듈.
 *
 * 캐시 정책:
 *   - Redis 키: `bsky:handle:<lowercase-handle>`
 *   - 성공값: DID 문자열, 30 일 TTL
 *   - 실패값: `NX` sentinel, 10 분 TTL (404 / 비정상 응답에 대한 retry 폭주 방지)
 *   - Redis 장애 시: 직접 fetch 후 캐시 없이 DID 반환 (graceful degradation)
 *
 * 외부 API:
 *   - GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle
 *   - 공개 API, 인증 불필요. SSRF 위험 없음 (도메인 고정).
 *
 * Bug: damoang.net #12050
 */
import { getRedis } from '../redis.js';

const RESOLVE_API = 'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle';
const REDIS_KEY_PREFIX = 'bsky:handle:';
const TTL_SUCCESS_SEC = 60 * 60 * 24 * 30; // 30 일
const TTL_NX_SEC = 60 * 10; // 10 분
const NX_SENTINEL = 'NX';
const FETCH_TIMEOUT_MS = 3000;

/**
 * DID 문자열 형식 검증.
 * `did:plc:...` 또는 `did:web:...` 만 허용.
 */
export function isValidDID(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^did:(plc|web):[a-zA-Z0-9._:%-]+$/.test(value);
}

function normalizeHandle(handle: string): string {
    return handle.trim().toLowerCase();
}

/**
 * public.api.bsky.app 에 직접 fetch.
 * 타임아웃과 에러 처리 포함. 실패 시 null 반환.
 */
async function fetchDID(handle: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const url = `${RESOLVE_API}?handle=${encodeURIComponent(handle)}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });

        if (!res.ok) {
            return null;
        }

        const body = (await res.json()) as { did?: unknown };
        if (isValidDID(body.did)) {
            return body.did;
        }
        return null;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[bluesky-resolver] fetch failed for', handle, '-', msg);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Bluesky handle 을 DID 로 변환.
 *
 * @param handle Bluesky handle (예: `aagaming.me`).
 *   이미 `did:` 로 시작하는 값이 들어오면 형식 검증 후 그대로 반환.
 * @returns DID 문자열 또는 null (resolve 실패).
 */
export async function resolveBlueskyHandle(handle: string): Promise<string | null> {
    if (!handle || typeof handle !== 'string') return null;

    // 이미 DID 면 그대로 반환 (input safety).
    if (handle.startsWith('did:')) {
        return isValidDID(handle) ? handle : null;
    }

    const normalized = normalizeHandle(handle);
    if (!normalized) return null;

    const cacheKey = `${REDIS_KEY_PREFIX}${normalized}`;

    // 1. Redis lookup 시도. 장애 시 곧바로 fetch fallback.
    let redisAvailable = true;
    try {
        const redis = getRedis();
        const cached = await redis.get(cacheKey);
        if (cached === NX_SENTINEL) {
            return null;
        }
        if (cached && isValidDID(cached)) {
            return cached;
        }
    } catch (err) {
        redisAvailable = false;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[bluesky-resolver] Redis unavailable, falling back to direct fetch:', msg);
    }

    // 2. Redis 미스 → 외부 API 호출.
    const did = await fetchDID(normalized);

    // 3. 결과를 Redis 에 캐시 (Redis 사용 가능한 경우만).
    if (redisAvailable) {
        try {
            const redis = getRedis();
            if (did) {
                await redis.setex(cacheKey, TTL_SUCCESS_SEC, did);
            } else {
                await redis.setex(cacheKey, TTL_NX_SEC, NX_SENTINEL);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[bluesky-resolver] Redis setex failed:', msg);
        }
    }

    return did;
}

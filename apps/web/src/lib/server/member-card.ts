/**
 * 회원 카드(닉네임·프로필 사진·탈퇴 여부) 서버사이드 배치 조회
 *
 * 같은 회원 목록에 대해 닉네임·사진 조회와 탈퇴 조회를 따로 하던 것을 한 번으로 합친다.
 * - 공유 캐시(Redis): 키 `mbcard:{lower(mb_id)}`(CACHE_NAMESPACE 가 있으면 `{ns}:mbcard:{lower(mb_id)}`).
 *   백엔드의 회원 표시 정보 무효화와 같은 키 규칙이다. 프로세스 내부 캐시는 두지 않는다
 *   (두면 무효화가 그 프로세스에 닿지 않는다).
 * - 읽기는 MGET 한 번이고 짧은 시간 제한을 둔다. 시간 초과·오류면 캐시 없이 DB 에서 전부 읽는다.
 * - 미스만 DB 한 번으로 채우고, 채운 값은 응답을 기다리지 않고 저장한다(저장 실패는 무시).
 * - 결과 맵의 키는 요청한 id 그대로다(캐시 키만 소문자).
 * - 탈퇴 판정은 withdrawn-members.ts 와 같은 조건(`mb_leave_date != ''`, NULL 은 탈퇴 아님)이고,
 *   그 함수와 마찬가지로 영문·숫자·밑줄로만 된 id 만 탈퇴로 본다.
 * - 정확도 한계: 웹·백엔드를 거치지 않은 변경(별도 도구·DB 직접 수정)은 캐시 TTL 만큼 늦게 반영된다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import { redisKey } from '$lib/server/cache';

/** 한 번에 조회하는 회원 수 상한 — member-images / withdrawn-members 와 같다. */
const MAX_IDS = 200;
/** withdrawn-members.ts 가 탈퇴 조회 대상으로 인정하는 id 형식. */
const WITHDRAWN_ID_PATTERN = /^[a-zA-Z0-9_]+$/;

/** 캐시 키 prefix (백엔드 무효화와 공유하는 규칙). */
const CACHE_PREFIX = 'mbcard';
/** 캐시 TTL(초)과 만료 분산용 지터 상한(초). */
const CACHE_TTL_SEC = 600;
const CACHE_TTL_JITTER_SEC = 60;
/** 캐시 읽기(MGET) 시간 제한. 넘으면 캐시 없이 DB 로 간다. */
const CACHE_READ_TIMEOUT_MS = 100;
/** 무효화(DEL) 시간 제한. 넘으면 TTL 로 자연 만료된다. */
const CACHE_DELETE_TIMEOUT_MS = 500;
/** DB 에 없는 회원 표식(반복 미스 방지). */
const NOT_FOUND_MARKER = '-';
/** 무효화 때 함께 지우는 네임스페이스(공유 Redis 를 쓰는 환경들). '' = 네임스페이스 없음. */
const INVALIDATE_NAMESPACES = ['', 'canary'];

export interface MemberCard {
    /** mb_nick (없으면 빈 문자열) */
    nick: string;
    /** mb_image_url (없으면 빈 문자열) */
    image: string;
    /** mb_image_updated_at 의 unix epoch 초 (없으면 undefined) */
    imageUpdatedAt?: number;
    /** 탈퇴 회원 여부 */
    isLeft: boolean;
}

/** 캐시에 저장하는 짧은 형식: n=닉, i=사진 URL, u=사진 시각(초 또는 null), l=탈퇴(0/1). */
interface CachedCard {
    n: string;
    i: string;
    u: number | null;
    l: 0 | 1;
}

/** 캐시 값 해석 결과: 카드, 회원 없음(null), 해석 불가(undefined = 미스 취급). */
type CacheLookup = MemberCard | null | undefined;

function toCached(card: MemberCard): string {
    const value: CachedCard = {
        n: card.nick,
        i: card.image,
        u: card.imageUpdatedAt ?? null,
        l: card.isLeft ? 1 : 0
    };
    return JSON.stringify(value);
}

function fromCached(raw: string | null): CacheLookup {
    if (raw === null) return undefined;
    if (raw === NOT_FOUND_MARKER) return null;
    try {
        const v = JSON.parse(raw) as Partial<CachedCard>;
        if (!v || typeof v !== 'object') return undefined;
        return {
            nick: typeof v.n === 'string' ? v.n : '',
            image: typeof v.i === 'string' ? v.i : '',
            imageUpdatedAt: typeof v.u === 'number' && v.u > 0 ? v.u : undefined,
            isLeft: v.l === 1
        };
    } catch {
        return undefined;
    }
}

/** 캐시 키(현재 프로세스 네임스페이스 기준). */
function cardKey(lowerId: string): string {
    return redisKey(CACHE_PREFIX, lowerId);
}

/** 시간 제한이 있는 대기. 시간 초과면 reject. 원래 promise 의 늦은 실패는 삼킨다. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    promise.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('cache timeout')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function getRedisSafe(): ReturnType<typeof getRedis> | null {
    try {
        return getRedis() ?? null;
    } catch {
        return null;
    }
}

/** DB 에서 카드 조회 (쿼리 1회). 결과 키는 소문자 id. */
async function queryCards(ids: string[]): Promise<Map<string, MemberCard>> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_nick, COALESCE(mb_image_url, '') AS mb_image_url, mb_image_updated_at,
                (mb_leave_date IS NOT NULL AND mb_leave_date <> '') AS is_left
         FROM g5_member
         WHERE mb_id IN (?)`,
        [ids]
    );

    const found = new Map<string, MemberCard>();
    for (const row of rows) {
        const memberId = String(row.mb_id);
        found.set(memberId.toLowerCase(), {
            nick: row.mb_nick ? String(row.mb_nick) : '',
            image: row.mb_image_url ? String(row.mb_image_url) : '',
            imageUpdatedAt: row.mb_image_updated_at
                ? Math.floor(new Date(row.mb_image_updated_at).getTime() / 1000)
                : undefined,
            isLeft: Number(row.is_left) === 1 && WITHDRAWN_ID_PATTERN.test(memberId)
        });
    }
    return found;
}

/**
 * 회원 카드 배치 조회 (캐시 MGET 1회 + 미스가 있으면 쿼리 1회)
 * @param ids mb_id 배열 (중복·빈 값 허용 — 내부에서 정리)
 * @returns 요청한 mb_id → MemberCard 맵 (DB 에 없는 회원은 포함 안 됨)
 */
export async function fetchMemberCards(ids: string[]): Promise<Map<string, MemberCard>> {
    const nonEmptyIds = ids.filter((id) => typeof id === 'string' && id !== '');
    const uniqueIds = [...new Set(nonEmptyIds)].slice(0, MAX_IDS);

    const cards = new Map<string, MemberCard>();
    if (uniqueIds.length === 0) return cards;

    // 소문자 id → 대표 요청 id(첫 등장). 캐시 키와 DB 조회는 소문자 id 단위로 한 번만.
    const representative = new Map<string, string>();
    for (const id of uniqueIds) {
        const lower = id.toLowerCase();
        if (!representative.has(lower)) representative.set(lower, id);
    }
    const lowerIds = [...representative.keys()];

    // 소문자 id → 카드(null = 회원 없음)
    const resolved = new Map<string, MemberCard | null>();
    const redis = getRedisSafe();
    let cacheUsable = false;

    if (redis) {
        try {
            const values = await withTimeout(
                redis.mget(...lowerIds.map(cardKey)),
                CACHE_READ_TIMEOUT_MS
            );
            lowerIds.forEach((lower, idx) => {
                const hit = fromCached(values[idx] ?? null);
                if (hit !== undefined) resolved.set(lower, hit);
            });
            cacheUsable = true;
        } catch {
            // 시간 초과·오류 → 캐시 없이 전부 DB
            resolved.clear();
        }
    }

    const missLowerIds = lowerIds.filter((lower) => !resolved.has(lower));
    if (missLowerIds.length > 0) {
        const queryIds = missLowerIds.map((lower) => representative.get(lower) ?? lower);
        const found = await queryCards(queryIds);
        for (const lower of missLowerIds) {
            resolved.set(lower, found.get(lower) ?? null);
        }

        if (redis && cacheUsable) {
            try {
                const pipeline = redis.pipeline();
                for (const lower of missLowerIds) {
                    const card = resolved.get(lower);
                    const ttl = CACHE_TTL_SEC + Math.floor(Math.random() * CACHE_TTL_JITTER_SEC);
                    pipeline.setex(cardKey(lower), ttl, card ? toCached(card) : NOT_FOUND_MARKER);
                }
                // 응답을 기다리지 않는다. 저장 실패는 무시(다음 조회가 다시 채운다).
                pipeline.exec().catch(() => {});
            } catch {
                // 저장 실패 무시
            }
        }
    }

    for (const id of uniqueIds) {
        const card = resolved.get(id.toLowerCase());
        if (card) cards.set(id, card);
    }
    return cards;
}

/**
 * 회원 카드 캐시 키 목록 — 현재 프로세스 네임스페이스 키 + 네임스페이스 없는 키 + canary 키.
 * 공유 Redis 를 쓰는 환경 모두의 키를 지워야 다른 환경에 낡은 값이 남지 않는다.
 */
export function memberCardCacheKeys(mbId: string): string[] {
    if (!mbId) return [];
    const lower = mbId.toLowerCase();
    const keys = new Set<string>([cardKey(lower)]);
    for (const ns of INVALIDATE_NAMESPACES) {
        keys.add(ns ? `${ns}:${CACHE_PREFIX}:${lower}` : `${CACHE_PREFIX}:${lower}`);
    }
    return [...keys];
}

/**
 * 회원 표시 정보(닉네임·사진·탈퇴 여부)가 바뀐 뒤 캐시를 지운다.
 * 쓰기가 성공한 뒤 부른다. 실패해도 던지지 않는다(TTL 로 자연 만료).
 */
export async function invalidateMemberCard(mbId: string): Promise<void> {
    const keys = memberCardCacheKeys(mbId);
    if (keys.length === 0) return;
    const redis = getRedisSafe();
    if (!redis) return;
    try {
        await withTimeout(redis.del(...keys), CACHE_DELETE_TIMEOUT_MS);
    } catch {
        // 무시 — TTL 로 자연 만료
    }
}

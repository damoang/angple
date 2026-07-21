/**
 * 직접홍보 광고 데이터 fetcher (Redis 캐시)
 *
 * ads 서버에서 프로모션 게시글을 직접 가져옵니다.
 * Redis 캐시로 모든 Pod에서 즉시 무효화 가능.
 * 글 작성/수정/삭제 시 invalidatePromotionCache()로 Redis 키 삭제.
 */

import { getAdsServerUrl } from './config';
import { getRedis } from '$lib/server/redis';

const PROMOTION_CACHE_TTL_SEC = 86_400; // 24시간 (글 작성 시 무효화)
const PROMOTION_POSTS_TIMEOUT_MS = 500;
// 백그라운드 갱신은 SSR 응답을 블로킹하지 않으므로 ads 서버의 실제 소요(수 초~십수 초)를 감당할 만큼 넉넉히.
const PROMOTION_BOARD_BG_TIMEOUT_MS = 30_000;
// 갱신 단일화(전 Pod) 락 TTL — 갱신 소요보다 약간 길게.
const PROMOTION_REFRESH_LOCK_TTL_SEC = 35;

const REDIS_KEY_BOARD = 'promotion:board_posts';
// 만료 없는 마지막-정상본. fresh 미스/ads 지연 시에도 에러 대신 이걸 서빙한다.
const REDIS_KEY_BOARD_STALE = 'promotion:board_posts:stale';
// 전 Pod 갱신 단일화 락.
const REDIS_KEY_BOARD_LOCK = 'promotion:board_posts:refresh_lock';
const REDIS_KEY_POSTS = 'promotion:posts';

const EMPTY_RESPONSE = { success: false, data: { posts: [] } };

interface PromotionBoardPostsResponse {
    success: boolean;
    data: PromotionBoardPost[];
    meta: { total: number; advertiser_count: number };
}

interface PromotionBoardPost {
    wr_id: number;
    wr_subject: string;
    wr_content: string;
    mb_id: string;
    wr_name: string;
    wr_datetime: string;
    wr_hit: number;
    wr_good: number;
    wr_comment: number;
    wr_link1: string;
    wr_link2: string;
    wr_option: string;
    advertiser_name: string;
    pin_to_top: boolean;
    thumbnail: string;
    file_count: number;
}

// 빈 목록이지만 success:true — 로더가 하드 에러("게시글을 불러오는데 실패") 대신
// 빈 게시판을 렌더하게 한다. 최초 1회(stale 부재) 외에는 거의 도달하지 않는다.
const EMPTY_BOARD_OK: PromotionBoardPostsResponse = {
    success: true,
    data: [],
    meta: { total: 0, advertiser_count: 0 }
};

// 같은 Pod 내 백그라운드 갱신 중복 방지 플래그.
let refreshInFlight = false;

/**
 * ads 서버에서 최신 목록을 받아 fresh + stale 캐시에 저장.
 * SSR 응답 경로에서 await 하지 않고 fire-and-forget 으로 호출한다(요청을 절대 블로킹하지 않음).
 * 전 Pod 단일화를 위해 Redis 락(NX)을 사용한다.
 */
async function triggerBackgroundRefresh(): Promise<void> {
    if (refreshInFlight) return;
    refreshInFlight = true;
    let hasLock = false;
    try {
        try {
            const redis = getRedis();
            const locked = await redis.set(
                REDIS_KEY_BOARD_LOCK,
                '1',
                'EX',
                PROMOTION_REFRESH_LOCK_TTL_SEC,
                'NX'
            );
            hasLock = locked === 'OK';
            if (!hasLock) return; // 다른 Pod가 이미 갱신 중
        } catch {
            // Redis 락 실패 시에도 로컬 플래그로만 단일화하고 진행
        }

        const res = await fetch(`${getAdsServerUrl()}/api/v1/serve/promotion-board-posts`, {
            signal: AbortSignal.timeout(PROMOTION_BOARD_BG_TIMEOUT_MS)
        });
        if (!res.ok) return;
        const data = (await res.json()) as PromotionBoardPostsResponse;
        if (!data?.success || !Array.isArray(data?.data)) return;

        try {
            const redis = getRedis();
            const payload = JSON.stringify(data);
            await redis.set(REDIS_KEY_BOARD, payload, 'EX', PROMOTION_CACHE_TTL_SEC);
            await redis.set(REDIS_KEY_BOARD_STALE, payload); // 만료 없음: 마지막-정상본 보존
        } catch {
            // Redis 저장 실패 무시
        }
    } catch (err) {
        console.error(
            '[promotion] background refresh failed:',
            err instanceof Error ? err.message : err
        );
    } finally {
        refreshInFlight = false;
        if (hasLock) {
            try {
                await getRedis().del(REDIS_KEY_BOARD_LOCK);
            } catch {
                // 락 해제 실패는 TTL로 자동 만료됨
            }
        }
    }
}

/**
 * 프로모션 게시판 목록 조회 (stale-while-revalidate).
 * 1) fresh 캐시 히트 → 반환
 * 2) 미스 → 백그라운드 갱신을 fire-and-forget 으로 트리거하고, SSR은 절대 ads 를 기다리지 않는다
 * 3) stale(마지막-정상본) 즉시 반환 → ads 가 느려도 사용자는 에러 대신 직전 목록을 본다
 * 4) stale 도 없으면(최초 1회) 빈 목록(success:true) → 하드 에러 방지
 */
export async function fetchPromotionBoardPosts(): Promise<PromotionBoardPostsResponse> {
    try {
        const redis = getRedis();
        const cached = await redis.get(REDIS_KEY_BOARD);
        if (cached) return JSON.parse(cached);
    } catch {
        // Redis 실패 시 아래 stale/빈 목록 경로로 진행
    }

    // fresh 미스 — 요청 경로를 블로킹하지 않고 백그라운드 갱신만 시작
    void triggerBackgroundRefresh();

    try {
        const redis = getRedis();
        const stale = await redis.get(REDIS_KEY_BOARD_STALE);
        if (stale) return JSON.parse(stale);
    } catch {
        // 무시
    }

    return EMPTY_BOARD_OK;
}

export type { PromotionBoardPost, PromotionBoardPostsResponse };

/** 캐시가 warm인지 확인 (SSR 직접 포함 여부 판단용) */
export async function isPromotionCacheWarm(): Promise<boolean> {
    try {
        const redis = getRedis();
        return (await redis.exists(REDIS_KEY_POSTS)) === 1;
    } catch {
        return false;
    }
}

/** promotion 게시판 글 작성/수정/삭제 시 호출 — 전 Pod 즉시 반영 */
export async function invalidatePromotionCache(): Promise<void> {
    try {
        const redis = getRedis();
        await redis.del(REDIS_KEY_BOARD, REDIS_KEY_POSTS);
    } catch {
        // Redis 실패 시 무시
    }
}

export async function fetchPromotionPosts(): Promise<unknown> {
    try {
        const redis = getRedis();
        const cached = await redis.get(REDIS_KEY_POSTS);
        if (cached) return JSON.parse(cached);
    } catch {
        // Redis 실패 시 ads 서버 직접 호출
    }

    try {
        const res = await fetch(`${getAdsServerUrl()}/api/v1/serve/promotion-posts`, {
            signal: AbortSignal.timeout(PROMOTION_POSTS_TIMEOUT_MS)
        });
        if (!res.ok) return EMPTY_RESPONSE;
        const data = await res.json();

        try {
            const redis = getRedis();
            await redis.set(REDIS_KEY_POSTS, JSON.stringify(data), 'EX', PROMOTION_CACHE_TTL_SEC);
        } catch {
            // Redis 저장 실패 무시
        }

        return data;
    } catch (err) {
        console.error('[promotion] posts fetch failed:', err instanceof Error ? err.message : err);
        return EMPTY_RESPONSE;
    }
}

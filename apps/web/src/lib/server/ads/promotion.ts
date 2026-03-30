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
const PROMOTION_BOARD_TIMEOUT_MS = 1_500;

const REDIS_KEY_BOARD = 'promotion:board_posts';
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

const EMPTY_BOARD_RESPONSE: PromotionBoardPostsResponse = {
    success: false,
    data: [],
    meta: { total: 0, advertiser_count: 0 }
};

export async function fetchPromotionBoardPosts(): Promise<PromotionBoardPostsResponse> {
    try {
        const redis = getRedis();
        const cached = await redis.get(REDIS_KEY_BOARD);
        if (cached) return JSON.parse(cached);
    } catch {
        // Redis 실패 시 ads 서버 직접 호출
    }

    try {
        const res = await fetch(`${getAdsServerUrl()}/api/v1/serve/promotion-board-posts`, {
            signal: AbortSignal.timeout(PROMOTION_BOARD_TIMEOUT_MS)
        });
        if (!res.ok) return EMPTY_BOARD_RESPONSE;
        const data = await res.json();

        try {
            const redis = getRedis();
            await redis.set(REDIS_KEY_BOARD, JSON.stringify(data), 'EX', PROMOTION_CACHE_TTL_SEC);
        } catch {
            // Redis 저장 실패 무시
        }

        return data;
    } catch (err) {
        console.error(
            '[promotion] board posts fetch failed:',
            err instanceof Error ? err.message : err
        );
        return EMPTY_BOARD_RESPONSE;
    }
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

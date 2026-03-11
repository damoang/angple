/**
 * 직접홍보 광고 데이터 fetcher (인메모리 캐시)
 *
 * ads 서버에서 프로모션 게시글을 직접 가져옵니다.
 * SvelteKit self-call 프록시를 거치지 않아 hooks.server.ts 재진입을 방지합니다.
 * 30초 TTL 인메모리 캐시로 반복 호출을 최소화합니다.
 */

import { getAdsServerUrl } from './config';

const PROMOTION_CACHE_TTL = 30_000; // 30초
const PROMOTION_POSTS_TIMEOUT_MS = 500;
const PROMOTION_BOARD_TIMEOUT_MS = 1_500;

let promotionCache: { data: unknown; expiresAt: number } | null = null;

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

let promotionBoardCache: { data: PromotionBoardPostsResponse; expiresAt: number } | null = null;

const EMPTY_BOARD_RESPONSE: PromotionBoardPostsResponse = {
    success: false,
    data: [],
    meta: { total: 0, advertiser_count: 0 }
};

export async function fetchPromotionBoardPosts(): Promise<PromotionBoardPostsResponse> {
    const now = Date.now();
    if (promotionBoardCache && now < promotionBoardCache.expiresAt) {
        return promotionBoardCache.data;
    }
    try {
        const res = await fetch(`${getAdsServerUrl()}/api/v1/serve/promotion-board-posts`, {
            signal: AbortSignal.timeout(PROMOTION_BOARD_TIMEOUT_MS)
        });
        if (!res.ok) return EMPTY_BOARD_RESPONSE;
        const data = await res.json();
        promotionBoardCache = { data, expiresAt: now + PROMOTION_CACHE_TTL };
        return data;
    } catch {
        return EMPTY_BOARD_RESPONSE;
    }
}

export type { PromotionBoardPost, PromotionBoardPostsResponse };

export async function fetchPromotionPosts(): Promise<unknown> {
    const now = Date.now();
    if (promotionCache && now < promotionCache.expiresAt) {
        return promotionCache.data;
    }
    try {
        const res = await fetch(`${getAdsServerUrl()}/api/v1/serve/promotion-posts`, {
            signal: AbortSignal.timeout(PROMOTION_POSTS_TIMEOUT_MS)
        });
        if (!res.ok) return EMPTY_RESPONSE;
        const data = await res.json();
        promotionCache = { data, expiresAt: now + PROMOTION_CACHE_TTL };
        return data;
    } catch {
        return EMPTY_RESPONSE;
    }
}

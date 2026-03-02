/**
 * 직접홍보 광고 데이터 fetcher (인메모리 캐시)
 *
 * ads 서버(localhost:9090)에서 프로모션 게시글을 직접 가져옵니다.
 * SvelteKit self-call 프록시를 거치지 않아 hooks.server.ts 재진입을 방지합니다.
 * 30초 TTL 인메모리 캐시로 반복 호출을 최소화합니다.
 */

const ADS_SERVER_URL = 'http://localhost:9090';
const PROMOTION_CACHE_TTL = 30_000; // 30초

let promotionCache: { data: unknown; expiresAt: number } | null = null;

const EMPTY_RESPONSE = { success: false, data: { posts: [] } };

export async function fetchPromotionPosts(): Promise<unknown> {
    const now = Date.now();
    if (promotionCache && now < promotionCache.expiresAt) {
        return promotionCache.data;
    }
    try {
        const res = await fetch(`${ADS_SERVER_URL}/api/v1/serve/promotion-posts`);
        if (!res.ok) return EMPTY_RESPONSE;
        const data = await res.json();
        promotionCache = { data, expiresAt: now + PROMOTION_CACHE_TTL };
        return data;
    } catch {
        return EMPTY_RESPONSE;
    }
}

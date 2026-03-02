import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function getAdsServerUrl(): string {
    return process.env.ADS_SERVER_URL || 'http://localhost:9090';
}

// GET /api/ads/promotion-posts
// damoang-ads 서버 프록시 (직접홍보 게시글)
export const GET: RequestHandler = async () => {
    try {
        const response = await fetch(`${getAdsServerUrl()}/api/v1/serve/promotion-posts`);
        if (!response.ok) {
            return json({ success: false, data: { posts: [], count: 0 } });
        }
        return json(await response.json());
    } catch {
        return json({ success: false, data: { posts: [], count: 0 } });
    }
};

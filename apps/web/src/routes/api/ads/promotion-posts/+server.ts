import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ADS_URL = process.env.ADS_URL || 'http://localhost:9090';
const EMPTY = { success: false, data: { posts: [], count: 0 } };

// GET /api/ads/promotion-posts
// damoang-ads 서버 프록시 (직접홍보 게시글)
export const GET: RequestHandler = async () => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${ADS_URL}/api/v1/serve/promotion-posts`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) return json(EMPTY);
        return json(await response.json());
    } catch {
        return json(EMPTY);
    }
};

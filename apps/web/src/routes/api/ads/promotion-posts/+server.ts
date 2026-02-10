import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/ads/promotion-posts
// damoang-ads 서버 프록시 (직접홍보 게시글)
export const GET: RequestHandler = async () => {
	try {
		const response = await fetch('http://localhost:9090/api/v1/serve/promotion-posts');
		if (!response.ok) {
			return json({ success: false, data: { posts: [], count: 0 } });
		}
		return json(await response.json());
	} catch {
		return json({ success: false, data: { posts: [], count: 0 } });
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/ads/banners?position=board-head&limit=1
// ads.damoang.net 프록시 (Cloudflare 우회)
export const GET: RequestHandler = async ({ url }) => {
	const position = url.searchParams.get('position') || '';
	const limit = url.searchParams.get('limit') || '1';

	try {
		const response = await fetch(
			`http://localhost:9090/api/v1/serve/banners?position=${encodeURIComponent(position)}&limit=${limit}`
		);
		if (!response.ok) {
			return json({ success: false, data: { banners: [], count: 0 } });
		}
		return json(await response.json());
	} catch {
		return json({ success: false, data: { banners: [], count: 0 } });
	}
};

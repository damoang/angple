import { json } from '@sveltejs/kit';
import { getAdsServerUrl } from '$lib/server/ads/config';
import { createCache } from '$lib/server/cache';
import type { RequestHandler } from './$types';

// 인메모리 캐시 (60초 TTL, singleflight 내장)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bannerProxyCache = createCache<any>({ ttl: 60_000, maxSize: 50 });

// GET /api/ads/banners?position=board-head&limit=1
// ads.damoang.net 프록시 (Cloudflare 우회, 60초 singleflight 캐시)
export const GET: RequestHandler = async ({ url }) => {
    const position = url.searchParams.get('position') || '';
    const limit = url.searchParams.get('limit') || '1';
    const cacheKey = `${position}:${limit}`;

    try {
        const data = await bannerProxyCache.getOrSet(cacheKey, async () => {
            const adsServerUrl = getAdsServerUrl();
            const response = await fetch(
                `${adsServerUrl}/api/v1/serve/banners?position=${encodeURIComponent(position)}&limit=${limit}`
            );
            if (!response.ok) {
                return { success: false, data: { banners: [], count: 0 } };
            }
            return response.json();
        });

        return json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        });
    } catch {
        return json({ success: false, data: { banners: [], count: 0 } });
    }
};

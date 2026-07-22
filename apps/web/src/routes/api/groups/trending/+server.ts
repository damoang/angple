import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTrendingGroups, clampLimit } from '../../../groups/trending-groups-data.js';

/**
 * GET /api/groups/trending?limit=5
 * 활동순 상위 소모임(3~5개)을 반환한다. "지금 뜨는 소모임" 사이드바 위젯 전용.
 * 60초 인메모리/Redis 캐시 + 60초 HTTP 캐시(swr 120)로 read 부하를 억제한다.
 */
export const GET: RequestHandler = async ({ url }) => {
    const limit = clampLimit(url.searchParams.get('limit'));

    try {
        const items = await loadTrendingGroups(limit);
        return json(
            { items },
            { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } }
        );
    } catch (err) {
        console.error('[api/groups/trending] error:', err);
        return json({ items: [] }, { status: 500 });
    }
};

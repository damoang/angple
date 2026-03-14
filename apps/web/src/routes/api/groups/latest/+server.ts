import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadLatestPostsPaginated } from '../../../groups/groups-data.js';

export const GET: RequestHandler = async ({ url }) => {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));

    try {
        const result = await loadLatestPostsPaginated(page, limit);
        return json(result, {
            headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' }
        });
    } catch (err) {
        console.error('[api/groups/latest] error:', err);
        return json({ items: [], total: 0, hasMore: false }, { status: 500 });
    }
};

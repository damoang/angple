import type { RequestHandler } from './$types';
import { getRecentPages } from '$lib/server/wiki';
import { json } from '@sveltejs/kit';

/**
 * 최근 변경된 위키 문서 API
 * GET /api/wiki/recent?limit=5
 */
export const GET: RequestHandler = async ({ url }) => {
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(1, parseInt(limitParam || '5', 10)), 20);

    try {
        const pages = await getRecentPages(limit);

        return json(
            pages.map((page) => ({
                path: page.path,
                title: page.title,
                updated_at: page.updated_at
            }))
        );
    } catch (error) {
        console.error('[API Wiki Recent] Error:', error);
        return json([], { status: 500 });
    }
};

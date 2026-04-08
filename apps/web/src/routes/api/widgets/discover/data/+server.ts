/**
 * GET /api/widgets/discover/data
 *
 * 모아보기 JSON 캐시 파일을 읽어서 반환.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildDiscoverPreviewData, loadDiscoverData } from '$lib/server/discover-loader';

export const GET: RequestHandler = async () => {
    const data = await loadDiscoverData();

    if (!data) {
        error(404, '모아보기 캐시 파일을 찾을 수 없습니다');
    }

    return json(buildDiscoverPreviewData(data), {
        headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300, max-age=60'
        }
    });
};

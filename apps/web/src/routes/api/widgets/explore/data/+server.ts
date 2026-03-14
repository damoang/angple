/**
 * GET /api/widgets/explore/data
 *
 * 톺아보기 JSON 캐시 파일을 읽어서 반환.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadExploreData } from '$lib/server/explore-loader';

export const GET: RequestHandler = async () => {
    const data = await loadExploreData();

    if (!data) {
        error(404, '톺아보기 캐시 파일을 찾을 수 없습니다');
    }

    return json(data, {
        headers: {
            'Cache-Control': 'public, max-age=60'
        }
    });
};

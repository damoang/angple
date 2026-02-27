/**
 * GET /api/widgets/recommended/data?period=6h
 *
 * 추천글 JSON 캐시 파일을 읽어서 반환.
 * 탭 전환 시 클라이언트에서 호출됨.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecommendedPeriod } from '$lib/api/types';
import { loadRecommendedData } from '$lib/server/recommended-loader';

const VALID_PERIODS = new Set(['1h', '3h', '6h', '12h', '24h', '48h']);

export const GET: RequestHandler = async ({ url }) => {
    const period = url.searchParams.get('period') || '6h';

    if (!VALID_PERIODS.has(period)) {
        error(400, `잘못된 period: ${period}. 가능한 값: ${[...VALID_PERIODS].join(', ')}`);
    }

    const data = await loadRecommendedData(period as RecommendedPeriod);

    if (!data) {
        error(404, '추천글 캐시 파일을 찾을 수 없습니다');
    }

    return json(data, {
        headers: {
            'Cache-Control': 'public, max-age=60'
        }
    });
};

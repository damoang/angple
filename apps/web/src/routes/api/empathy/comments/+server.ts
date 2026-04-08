/**
 * GET /api/empathy/comments?date=2026-03-14
 *
 * 공감글 댓글 데이터만 반환. 댓글 탭 클릭 시 lazy-load용.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    loadDailyRecommended,
    getTodayKST,
    isValidDate
} from '$lib/server/daily-recommended-loader';

export const GET: RequestHandler = async ({ url }) => {
    const date = url.searchParams.get('date') || getTodayKST();

    if (!isValidDate(date)) {
        error(400, `잘못된 날짜 형식: ${date}. YYYY-MM-DD 형식을 사용하세요.`);
    }

    const data = await loadDailyRecommended(date);

    if (!data) {
        error(404, `${date} 공감글 데이터를 찾을 수 없습니다`);
    }

    return json(data.comments ?? null, {
        headers: {
            'Cache-Control': 'public, max-age=60'
        }
    });
};

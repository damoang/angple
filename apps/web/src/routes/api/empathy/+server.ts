/**
 * GET /api/recommended/daily?date=2026-03-14
 *
 * 날짜별 공감글 JSON 반환. date 미지정 시 오늘 데이터.
 * 클라이언트 폴링용 (오늘 페이지에서 5분 간격).
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

    return json(data, {
        headers: {
            'Cache-Control': 'public, max-age=60'
        }
    });
};

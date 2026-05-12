import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
    loadDailyCalendar,
    loadDailyRecommended,
    isValidDate
} from '$lib/server/daily-recommended-loader';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
    // 과거 날짜 공감글은 불변 → 1시간 CDN 캐시, stale 7일 허용.
    setHeaders({
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=604800, max-age=0'
    });
    const { date } = params;

    if (!isValidDate(date)) {
        error(400, '잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용하세요.');
    }

    const [calendar, dailyData] = await Promise.all([
        loadDailyCalendar(),
        loadDailyRecommended(date)
    ]);

    // comments를 SSR payload에서 제거 (비용 절감)
    const { comments, ...dailyDataWithoutComments } = dailyData ?? {};

    return {
        date,
        calendar,
        dailyData: dailyData ? (dailyDataWithoutComments as typeof dailyData) : null
    };
};

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadDailyCalendar, loadDailyEmpathy, isValidDate } from '$lib/server/daily-empathy-loader';

export const load: PageServerLoad = async ({ params }) => {
    const { date } = params;

    if (!isValidDate(date)) {
        error(400, '잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용하세요.');
    }

    const [calendar, dailyData] = await Promise.all([loadDailyCalendar(), loadDailyEmpathy(date)]);

    // comments를 SSR payload에서 제거 (비용 절감)
    const { comments, ...dailyDataWithoutComments } = dailyData ?? {};

    return {
        date,
        calendar,
        dailyData: dailyData ? (dailyDataWithoutComments as typeof dailyData) : null
    };
};

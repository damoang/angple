import type { PageServerLoad } from './$types';
import { loadDailyCalendar, loadDailyEmpathy, getTodayKST } from '$lib/server/daily-empathy-loader';

export const load: PageServerLoad = async () => {
    const today = getTodayKST();

    const [calendar, dailyData] = await Promise.all([loadDailyCalendar(), loadDailyEmpathy(today)]);

    // comments를 SSR payload에서 제거 (비용 절감: 88% payload 감소)
    // 댓글은 클라이언트에서 /api/empathy/comments로 lazy-load
    const { comments, ...dailyDataWithoutComments } = dailyData ?? {};

    return {
        date: today,
        calendar,
        dailyData: dailyData ? (dailyDataWithoutComments as typeof dailyData) : null
    };
};

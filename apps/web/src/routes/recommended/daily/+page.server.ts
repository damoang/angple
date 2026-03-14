import type { PageServerLoad } from './$types';
import {
    loadDailyCalendar,
    loadDailyRecommended,
    getTodayKST
} from '$lib/server/daily-recommended-loader';

export const load: PageServerLoad = async () => {
    const today = getTodayKST();

    const [calendar, dailyData] = await Promise.all([
        loadDailyCalendar(),
        loadDailyRecommended(today)
    ]);

    return {
        date: today,
        calendar,
        dailyData
    };
};

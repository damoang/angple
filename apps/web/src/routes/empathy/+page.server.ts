import type { PageServerLoad } from './$types';
import {
    loadDailyCalendar,
    loadDailyRecommended,
    getTodayKST
} from '$lib/server/daily-recommended-loader';

export const load: PageServerLoad = async ({ setHeaders }) => {
    // 오늘 공감글: 비로그인 60초 CDN 캐시. cron 갱신(1h) 주기 대비 짧게 설정.
    setHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=3600, max-age=0' });
    const today = getTodayKST();

    const [calendar, dailyData] = await Promise.all([
        loadDailyCalendar(),
        loadDailyRecommended(today)
    ]);

    // comments를 SSR payload에서 제거 (비용 절감: 88% payload 감소)
    // 댓글은 클라이언트에서 /api/empathy/comments로 lazy-load
    const { comments, ...dailyDataWithoutComments } = dailyData ?? {};

    return {
        date: today,
        calendar,
        dailyData: dailyData ? (dailyDataWithoutComments as typeof dailyData) : null
    };
};

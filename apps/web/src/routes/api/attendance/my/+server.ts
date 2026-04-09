import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool, getKSTDate } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

/** GET /api/attendance/my — 내 출석 기록 */
export const GET: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) {
        return json({ success: false, error: '로그인이 필요합니다' }, { status: 401 });
    }

    try {
        const pool = getPool();

        // 최근 출석 기록
        const [recent] = await pool.query(
            'SELECT id, day, point, `rank` as att_rank, subject, datetime FROM g5_attendance2 WHERE mb_id = ? ORDER BY datetime DESC LIMIT 30',
            [getMbId(user)]
        );

        // 통계
        const [stats] = await pool.query(
            `SELECT COUNT(*) as total_days,
                    SUM(point) as total_points,
                    MAX(day) as max_streak
             FROM g5_attendance2
             WHERE mb_id = ?`,
            [getMbId(user)]
        ) as any;

        // 오늘 출석 여부
        const today = getKSTDate();
        const [todayCheck] = await pool.query(
            `SELECT id FROM g5_attendance2 WHERE mb_id = ? AND DATE(datetime) = ?`,
            [getMbId(user), today]
        ) as any;

        return json({
            success: true,
            data: {
                user_id: getMbId(user),
                nickname: user.nickname,
                checked_today: todayCheck.length > 0,
                stats: stats[0],
                recent
            }
        });
    } catch (error) {
        console.error('[Attendance] my error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

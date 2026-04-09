import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/attendance/ranking — 전체 랭킹 (포인트 순) */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

        const [rows] = await pool.query(
            `SELECT a.mb_id, m.mb_nick as nickname,
                    COUNT(*) as total_days,
                    SUM(a.point) as total_points,
                    MAX(a.day) as max_streak,
                    MAX(a.datetime) as last_attendance
             FROM g5_attendance2 a
             LEFT JOIN g5_member m ON a.mb_id = m.mb_id
             GROUP BY a.mb_id, m.mb_nick
             ORDER BY total_points DESC
             LIMIT ?`,
            [limit]
        );

        return json({ success: true, data: { ranking: rows } });
    } catch (error) {
        console.error('[Attendance] ranking error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

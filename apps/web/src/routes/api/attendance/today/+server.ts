import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool, getKSTDate } from '$lib/server/db/mysql';

/** GET /api/attendance/today — 오늘 출석 목록 + 순위 */
export const GET: RequestHandler = async () => {
    try {
        const pool = getPool();
        const today = getKSTDate();

        const [rows] = await pool.query(
            'SELECT a.id, a.mb_id, a.`rank` as att_rank, a.subject, a.day, a.point, a.datetime, m.mb_nick as nickname FROM g5_attendance2 a LEFT JOIN g5_member m ON a.mb_id = m.mb_id WHERE DATE(a.datetime) = ? ORDER BY a.datetime ASC',
            [today]
        );

        return json({ success: true, data: { date: today, attendees: rows } });
    } catch (error) {
        console.error('[Attendance] today error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

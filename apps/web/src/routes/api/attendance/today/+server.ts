import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool, getKSTDate } from '$lib/server/db/mysql';

/** GET /api/attendance/today — 오늘 출석 목록 + 순위 */
export const GET: RequestHandler = async () => {
    try {
        const pool = getPool();
        const today = getKSTDate();

        // KST 날짜 → UTC 범위: KST 00:00 = UTC 전날 15:00
        const utcStart = today + ' 00:00:00';
        const [rows] = await pool.query(
            'SELECT a.id, a.mb_id, a.`rank` as att_rank, a.subject, a.day, a.point, a.datetime, m.mb_nick as nickname FROM g5_attendance2 a INNER JOIN (SELECT mb_id, MIN(datetime) as min_dt FROM g5_attendance2 WHERE datetime >= DATE_SUB(?, INTERVAL 9 HOUR) AND datetime < DATE_SUB(? + INTERVAL 1 DAY, INTERVAL 9 HOUR) GROUP BY mb_id) t ON a.mb_id = t.mb_id AND a.datetime = t.min_dt LEFT JOIN g5_member m ON a.mb_id = m.mb_id ORDER BY a.datetime ASC',
            [utcStart, utcStart]
        );

        return json({ success: true, data: { date: today, attendees: rows } });
    } catch (error) {
        console.error('[Attendance] today error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

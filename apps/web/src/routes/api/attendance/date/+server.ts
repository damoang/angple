import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/attendance/date?date=2026-04-05 — 특정 날짜 출석자 목록 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const date = url.searchParams.get('date');
        const isMonth = url.searchParams.get('month') === 'true';

        if (!date) return json({ success: false, error: 'date 필요' }, { status: 400 });

        if (isMonth) {
            // 월별 전체 출석 기록 (달력 표시용)
            const yearMonth = date.slice(0, 7); // 2026-04
            const monthStart = yearMonth + '-01 00:00:00';
            const [rows] = await pool.query(
                'SELECT a.id, a.mb_id, m.mb_nick as nickname, a.`rank` as att_rank, a.subject, a.day, a.point, a.datetime FROM g5_attendance2 a INNER JOIN (SELECT mb_id, MIN(datetime) as min_dt FROM g5_attendance2 WHERE datetime >= DATE_SUB(?, INTERVAL 9 HOUR) AND datetime < DATE_SUB(? + INTERVAL 1 MONTH, INTERVAL 9 HOUR) GROUP BY mb_id, DATE(DATE_ADD(datetime, INTERVAL 9 HOUR))) t ON a.mb_id = t.mb_id AND a.datetime = t.min_dt LEFT JOIN g5_member m ON a.mb_id = m.mb_id ORDER BY a.datetime ASC',
                [monthStart, monthStart]
            );
            return json({ success: true, data: { date: yearMonth, attendees: rows } });
        }

        const dateStart = date + ' 00:00:00';
        const [rows] = await pool.query(
            'SELECT a.id, a.mb_id, m.mb_nick as nickname, a.`rank` as att_rank, a.subject, a.day, a.point, a.datetime FROM g5_attendance2 a INNER JOIN (SELECT mb_id, MIN(datetime) as min_dt FROM g5_attendance2 WHERE datetime >= DATE_SUB(?, INTERVAL 9 HOUR) AND datetime < DATE_SUB(? + INTERVAL 1 DAY, INTERVAL 9 HOUR) GROUP BY mb_id) t ON a.mb_id = t.mb_id AND a.datetime = t.min_dt LEFT JOIN g5_member m ON a.mb_id = m.mb_id ORDER BY a.datetime ASC',
            [dateStart, dateStart]
        );

        return json({ success: true, data: { date, attendees: rows } });
    } catch (error) {
        console.error('[Attendance] date error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

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
            const [rows] = await pool.query(
                'SELECT a.id, a.mb_id, m.mb_nick as nickname, a.`rank` as att_rank, a.subject, a.day, a.point, a.datetime FROM g5_attendance2 a LEFT JOIN g5_member m ON a.mb_id = m.mb_id WHERE DATE_FORMAT(a.datetime, "%Y-%m") = ? ORDER BY a.datetime ASC',
                [yearMonth]
            );
            return json({ success: true, data: { date: yearMonth, attendees: rows } });
        }

        const [rows] = await pool.query(
            'SELECT a.id, a.mb_id, m.mb_nick as nickname, a.`rank` as att_rank, a.subject, a.day, a.point, a.datetime FROM g5_attendance2 a LEFT JOIN g5_member m ON a.mb_id = m.mb_id WHERE DATE(a.datetime) = ? ORDER BY a.datetime ASC',
            [date]
        );

        return json({ success: true, data: { date, attendees: rows } });
    } catch (error) {
        console.error('[Attendance] date error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

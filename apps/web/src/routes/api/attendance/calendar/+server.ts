import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

/** GET /api/attendance/calendar?year=2026&month=4&mb_id=xxx — 월별 출석 달력 */
export const GET: RequestHandler = async ({ url, request }) => {
    try {
        const pool = getPool();
        const now = new Date();
        const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
        const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));

        // 로그인한 사용자 또는 쿼리 파라미터
        const user = getUserFromRequest(request);
        const mbId = url.searchParams.get('mb_id') || user?.user_id;

        if (!mbId) {
            return json({ success: false, error: '회원 ID가 필요합니다' }, { status: 400 });
        }

        const [rows] = await pool.query(
            'SELECT DATE(datetime) as date, day, point, `rank` as att_rank, subject FROM g5_attendance2 WHERE mb_id = ? AND YEAR(datetime) = ? AND MONTH(datetime) = ? ORDER BY datetime ASC',
            [mbId, year, month]
        );

        return json({ success: true, data: { year, month, mb_id: mbId, days: rows } });
    } catch (error) {
        console.error('[Attendance] calendar error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

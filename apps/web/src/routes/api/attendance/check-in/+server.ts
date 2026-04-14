import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool, getKSTDate, getKSTYesterday, getKSTDatetime } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

// 포인트 설정 (레거시 _setup.php와 동일)
const POINTS = {
    daily: 100,
    rank1: 100,
    rank2: 80,
    rank3: 50,
    streak15: 1000,
    streak30: 5000,
    streak365: 100000
};

/** POST /api/attendance/check-in — 출석 체크 */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) {
        return json({ success: false, error: '로그인이 필요합니다' }, { status: 401 });
    }

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const now = getKSTDatetime();  // KST 시간으로 저장
        const today = getKSTDate();
        const yesterday = getKSTYesterday();

        // 1. 중복 체크
        const [existing] = await conn.query(
            'SELECT id FROM g5_attendance2 WHERE mb_id = ? AND DATE(datetime) = ?',
            [getMbId(user), today]
        ) as any;

        if (existing.length > 0) {
            await conn.rollback();
            return json({ success: false, error: '오늘 이미 출석했습니다' }, { status: 409 });
        }

        // 2. 연속 출석일 계산
        const [yesterdayRow] = await conn.query(
            'SELECT day, reset, reset2, reset3 FROM g5_attendance2 WHERE mb_id = ? AND DATE(datetime) = ?',
            [getMbId(user), yesterday]
        ) as any;

        let day = 1;
        let reset = 1;
        let reset2 = 1;
        let reset3 = 1;

        if (yesterdayRow.length > 0) {
            const prev = yesterdayRow[0];
            day = prev.day + 1;
            reset = (prev.reset % 15) + 1;
            reset2 = (prev.reset2 % 30) + 1;
            reset3 = (prev.reset3 % 365) + 1;
        }

        // 3. 오늘 순위 계산
        const [todayCount] = await conn.query(
            'SELECT COUNT(*) as cnt FROM g5_attendance2 WHERE DATE(datetime) = ?',
            [today]
        ) as any;
        const rank = todayCount[0].cnt + 1;

        // 4. 포인트 계산
        let point = POINTS.daily;
        let bonusMsg = '';

        if (rank === 1) { point += POINTS.rank1; bonusMsg = '1등 보너스!'; }
        else if (rank === 2) { point += POINTS.rank2; bonusMsg = '2등 보너스!'; }
        else if (rank === 3) { point += POINTS.rank3; bonusMsg = '3등 보너스!'; }

        if (reset === 15) { point += POINTS.streak15; bonusMsg += ' 15일 연속 보너스!'; }
        if (reset2 === 30) { point += POINTS.streak30; bonusMsg += ' 30일 연속 보너스!'; }
        if (reset3 === 365) { point += POINTS.streak365; bonusMsg += ' 365일 연속 보너스!'; }

        // 5. 인사말
        const body = await request.json().catch(() => ({}));
        const subject = (body as any).subject || `${day}일째 출석합니다!`;

        // 6. g5_attendance2 INSERT
        await conn.query(
            `INSERT INTO g5_attendance2 (mb_id, \`rank\`, subject, day, sumday, reset, reset2, reset3, point, datetime)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
            [getMbId(user), rank <= 3 ? String(rank) : '', subject, day, reset, reset2, reset3, point, now]
        );

        // 7. g5_point INSERT (포인트 지급)
        await conn.query(
            `INSERT INTO g5_point (mb_id, po_datetime, po_content, po_point, po_use_point, po_expired, po_mb_point, po_rel_table, po_rel_id, po_rel_action)
             VALUES (?, ?, ?, ?, 0, 0, 0, 'attendance', '', 'checkin')`,
            [getMbId(user), now, `출석 ${day}일차 (${rank}등)`, point]
        );

        // 8. g5_member 포인트 업데이트
        await conn.query(
            'UPDATE g5_member SET mb_point = mb_point + ? WHERE mb_id = ?',
            [point, getMbId(user)]
        );

        await conn.commit();

        return json({
            success: true,
            data: {
                day,
                rank,
                point,
                bonus: bonusMsg.trim(),
                subject,
                reset,
                reset2,
                reset3
            }
        });
    } catch (error) {
        await conn.rollback();
        console.error('[Attendance] check-in error:', error);
        return json({ success: false, error: '출석 처리 실패' }, { status: 500 });
    } finally {
        conn.release();
    }
};

/**
 * 로그인 XP 소급 반영 API (관리자 전용, 1회성)
 *
 * GET  /api/admin/backfill-xp         — dry-run: 누락 건수 확인
 * POST /api/admin/backfill-xp         — 실제 소급 반영 실행
 *
 * 2026-03-05 ~ 현재 기간 동안 OAuth 로그인으로 누락된 XP를 소급 적립합니다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool, { readPool } from '$lib/server/db.js';
import { grantLoginXPForDate } from '$lib/server/auth/xp-grant.js';

interface MissingRow extends RowDataPacket {
    mb_id: string;
    login_date: string;
}

interface CountRow extends RowDataPacket {
    total: number;
    members: number;
}

interface MemberExpRow extends RowDataPacket {
    mb_id: string;
    as_exp: number;
    as_level: number;
    mb_level: number;
}

// Level thresholds — same as xp-grant.ts
const levelThresholds = [
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000,
    105000, 120000, 136000, 153000, 171000, 190000, 210000, 231000, 253000, 276000, 300000, 325000,
    351000, 378000, 406000, 435000, 466000, 499000, 534000, 571000, 610000, 651000, 694000, 739000,
    786000, 835000, 887000, 941000, 998000, 1058000, 1121000, 1187000, 1256000, 1328000, 1403000,
    1481000, 1563000, 1649000, 1739000, 1833000, 1931000, 2033000, 2139000, 2249000, 2363000,
    2481000, 2604000, 2732000, 2865000, 3003000, 3146000, 3294000, 3447000, 3605000, 3768000,
    3936000, 4110000, 4290000, 4476000, 4668000, 4866000, 5070000, 5280000, 5496000, 5718000,
    5946000, 6181000, 6423000, 6672000, 6928000, 7191000, 7461000, 7738000, 8022000, 8313000,
    8611000, 8917000, 9231000, 9553000, 9883000, 10221000, 10567000, 10921000, 11283000, 11653000,
    12031000, 12418000, 12814000, 13219000, 13633000, 14056000, 14488000, 14929000, 15379000,
    15838000
];

function calculateLevel(totalExp: number): number {
    let level = 1;
    for (let i = 0; i < levelThresholds.length; i++) {
        if (totalExp >= levelThresholds[i]) {
            level = i + 1;
        } else {
            break;
        }
    }
    return level;
}

const MISSING_QUERY = `
SELECT DISTINCT s.mb_id, DATE(s.created_at) as login_date
FROM angple_sessions s
WHERE s.created_at >= '2026-03-05'
  AND s.mb_id != ''
  AND NOT EXISTS (
    SELECT 1 FROM g5_na_xp x
    WHERE x.mb_id = s.mb_id
      AND x.xp_rel_action = DATE(s.created_at)
      AND x.xp_rel_table = '@login'
  )
ORDER BY s.mb_id, login_date
`;

const COUNT_QUERY = `
SELECT
  COUNT(*) as total,
  COUNT(DISTINCT s.mb_id) as members
FROM (
  SELECT DISTINCT s.mb_id, DATE(s.created_at) as login_date
  FROM angple_sessions s
  WHERE s.created_at >= '2026-03-05'
    AND s.mb_id != ''
    AND NOT EXISTS (
      SELECT 1 FROM g5_na_xp x
      WHERE x.mb_id = s.mb_id
        AND x.xp_rel_action = DATE(s.created_at)
        AND x.xp_rel_table = '@login'
    )
) s
`;

/** GET: dry-run — 누락 건수만 확인 */
export const GET: RequestHandler = async ({ locals }) => {
    if ((locals.user?.level ?? 0) < 10) {
        return json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    try {
        const [rows] = await readPool.query<CountRow[]>(COUNT_QUERY);
        const { total, members } = rows[0];

        return json({
            success: true,
            data: {
                missing_login_count: total,
                affected_members: members,
                estimated_xp: total * 500,
                period: '2026-03-05 ~ now'
            }
        });
    } catch (error) {
        console.error('[Backfill XP] dry-run error:', error);
        return json({ success: false, error: '조회에 실패했습니다.' }, { status: 500 });
    }
};

/** POST: 실제 소급 반영 실행 */
export const POST: RequestHandler = async ({ locals }) => {
    if ((locals.user?.level ?? 0) < 10) {
        return json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    try {
        // 누락된 로그인 레코드 조회
        const [missingRows] = await readPool.query<MissingRow[]>(MISSING_QUERY);

        if (missingRows.length === 0) {
            return json({
                success: true,
                data: { message: '소급 반영할 누락 로그인이 없습니다.', granted: 0, skipped: 0 }
            });
        }

        let granted = 0;
        let skipped = 0;

        // 회원별 누락 일수 집계
        const memberMissingDays = new Map<string, string[]>();
        for (const row of missingRows) {
            const dateStr =
                typeof row.login_date === 'string'
                    ? row.login_date
                    : new Date(row.login_date).toISOString().split('T')[0];
            if (!memberMissingDays.has(row.mb_id)) {
                memberMissingDays.set(row.mb_id, []);
            }
            memberMissingDays.get(row.mb_id)!.push(dateStr);
        }

        // 회원별로 일괄 처리
        for (const [mbId, dates] of memberMissingDays) {
            let grantedForMember = 0;

            for (const dateStr of dates) {
                const wasGranted = await grantLoginXPForDate(mbId, dateStr);
                if (wasGranted) {
                    grantedForMember++;
                    granted++;
                } else {
                    skipped++;
                }
            }

            if (grantedForMember > 0) {
                // as_exp 일괄 증가
                await pool.query(`UPDATE g5_member SET as_exp = as_exp + ? WHERE mb_id = ?`, [
                    grantedForMember * 500,
                    mbId
                ]);

                // mb_login_days 일괄 증가
                await pool.query(
                    `UPDATE g5_member SET mb_login_days = mb_login_days + ? WHERE mb_id = ?`,
                    [grantedForMember, mbId]
                );

                // 레벨 재계산
                const [memberRows] = await readPool.query<MemberExpRow[]>(
                    `SELECT COALESCE(as_exp, 0) as as_exp, COALESCE(as_level, 0) as as_level, mb_level FROM g5_member WHERE mb_id = ?`,
                    [mbId]
                );
                if (memberRows.length > 0) {
                    const member = memberRows[0];
                    const newLevel = calculateLevel(member.as_exp);
                    if (newLevel !== member.as_level) {
                        await pool.query(`UPDATE g5_member SET as_level = ? WHERE mb_id = ?`, [
                            newLevel,
                            mbId
                        ]);
                    }
                }
            }
        }

        console.log(
            `[Backfill XP] Completed: ${granted} granted, ${skipped} skipped, ${memberMissingDays.size} members`
        );

        return json({
            success: true,
            data: {
                granted,
                skipped,
                affected_members: memberMissingDays.size,
                total_xp_granted: granted * 500
            }
        });
    } catch (error) {
        console.error('[Backfill XP] execution error:', error);
        return json({ success: false, error: '소급 반영에 실패했습니다.' }, { status: 500 });
    }
};

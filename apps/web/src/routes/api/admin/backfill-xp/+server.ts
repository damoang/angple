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
import { calculateLevelFromExp as calculateLevel } from '$lib/utils/level-thresholds';

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

// 레벨 계산은 정본($lib/utils/level-thresholds)에 위임한다 — 위 import 참조.
//
// ⛔ 여기에 임계값 표를 다시 만들지 말 것. 원래 109개짜리 사본이 있었고,
//    그것이 백엔드와 다른 곡선이라 같은 회원이 화면마다 다른 레벨로 보이는
//    원인 중 하나였다(bug/13149, 2026-07-29).
//
// ⚠️ 이 엔드포인트의 POST 는 과거 LIMIT 없이 **전 회원 as_level 일괄 UPDATE** 가
//    가능했다(레벨 오르는 회원마다 xp-levelup-toast 발화 → 대량 동시 축하 사고 위험).
//    2026-07-31 부터 confirm + 회원 수 상한 가드가 걸려 있다 — POST 가드 주석 참조.

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

// POST 실행 가드 (#13149 후속): 실수로 누르면 전 회원 as_level 일괄 UPDATE 가 돌아
// 레벨업 토스트가 수천 명에게 동시 발화한다(PR#717 계열 사고). 두 겹으로 막는다:
//   ① body 에 confirm: 'backfill-xp' 명시 없이는 실행 거부
//   ② 1회 실행당 회원 수 상한(기본 100, 최대 1000) — 남은 수를 응답에 실어
//      조용히 잘리지 않게 한다. 전량은 상한 반복 실행으로만 가능.
const BACKFILL_DEFAULT_MEMBER_LIMIT = 100;
const BACKFILL_MAX_MEMBER_LIMIT = 1000;

/** POST: 실제 소급 반영 실행 (confirm + limit 필수) */
export const POST: RequestHandler = async ({ locals, request }) => {
    if ((locals.user?.level ?? 0) < 10) {
        return json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    let body: { confirm?: string; limit?: number } = {};
    try {
        body = await request.json();
    } catch {
        // body 없음 → 아래 confirm 가드에서 거부
    }
    if (body.confirm !== 'backfill-xp') {
        return json(
            {
                success: false,
                error:
                    "실행하려면 body 에 { confirm: 'backfill-xp', limit: <회원수> } 를 명시해야 합니다. " +
                    '전량 실행은 대량 레벨업 토스트를 발화시킵니다(#13149). GET 으로 dry-run 먼저 확인하세요.'
            },
            { status: 400 }
        );
    }
    const memberLimit = Math.min(
        Math.max(1, Math.floor(Number(body.limit) || BACKFILL_DEFAULT_MEMBER_LIMIT)),
        BACKFILL_MAX_MEMBER_LIMIT
    );

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

        // 상한 적용: memberLimit 명까지만 이번 실행에서 처리, 잔여는 응답으로 보고
        const allMembers = [...memberMissingDays.entries()];
        const batchMembers = allMembers.slice(0, memberLimit);
        const remainingMembers = allMembers.length - batchMembers.length;

        // 회원별로 일괄 처리
        for (const [mbId, dates] of batchMembers) {
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
            `[Backfill XP] Completed: ${granted} granted, ${skipped} skipped, ` +
                `${batchMembers.length}/${allMembers.length} members (remaining ${remainingMembers})`
        );

        return json({
            success: true,
            data: {
                granted,
                skipped,
                affected_members: batchMembers.length,
                remaining_members: remainingMembers,
                total_xp_granted: granted * 500,
                message:
                    remainingMembers > 0
                        ? `상한(${memberLimit}명)까지 처리했습니다. ${remainingMembers}명이 남아 있습니다 — 같은 요청을 반복 실행하세요.`
                        : '전체 처리 완료.'
            }
        });
    } catch (error) {
        console.error('[Backfill XP] execution error:', error);
        return json({ success: false, error: '소급 반영에 실패했습니다.' }, { status: 500 });
    }
};

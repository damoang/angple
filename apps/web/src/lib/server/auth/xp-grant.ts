/**
 * 로그인 XP 적립 (SvelteKit DB 직접 처리)
 *
 * OAuth 및 ID/PW 로그인 시 호출하여 일일 로그인 XP를 적립합니다.
 * Go 백엔드의 grantLoginXP()와 동일한 로직을 SvelteKit에서 처리합니다.
 *
 * - 하루 1회 500 XP (중복 방지)
 * - mb_login_days 증가
 * - as_level / mb_level 재계산
 */
import pool, { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { calculateLevelFromExp } from '$lib/utils/level-thresholds';

const LOGIN_XP = 500;

interface ExistingRow extends RowDataPacket {
    cnt: number;
}

interface MemberRow extends RowDataPacket {
    as_exp: number;
    as_level: number;
    mb_level: number;
}

/**
 * ⛔ 여기에 임계값 표를 다시 만들지 말 것 — 정본은 $lib/utils/level-thresholds 다.
 *
 * 원래 이 파일이 `1000·(n−1)²` 를 자체 생성해 썼다. 공식 자체는 백엔드와 같아
 * 저장값은 옳았지만, 웹의 다른 계산부는 109개짜리 계단식 표를 쓰고 있어
 * 같은 회원이 화면마다 다른 레벨로 보였다(bug/13149, 2026-07-29).
 * 지금은 정본이 같은 2차식이므로 그대로 위임한다.
 *
 * 상한만 달랐다(옛 110 vs 정본 5000). 실측상 as_exp 최대가 8,991,485(Lv.95)로
 * 110 경계(11,881,000)를 넘는 회원이 0명이라 저장값 변화는 없다.
 */
const calculateLevel = calculateLevelFromExp;

/**
 * 로그인 XP 적립
 * @param mbId 회원 ID
 * @param dateStr 적립 대상 날짜 (기본: 오늘, 소급 반영 시 과거 날짜 지정)
 */
export async function grantLoginXP(mbId: string, dateStr?: string): Promise<void> {
    const today = dateStr || new Date().toISOString().split('T')[0]; // "2026-03-15"

    // 1. 오늘 이미 적립했는지 확인 (중복 방지)
    const [existing] = await readPool.query<ExistingRow[]>(
        `SELECT COUNT(*) as cnt
         FROM g5_na_xp
         WHERE mb_id = ?
           AND xp_rel_table = '@login'
           AND xp_rel_action = ?
         LIMIT 1`,
        [mbId, today]
    );
    if (existing[0]?.cnt > 0) return;

    // 2. XP 로그 삽입
    await pool.query(
        `INSERT INTO g5_na_xp (mb_id, xp_point, xp_content, xp_rel_table, xp_rel_id, xp_rel_action, xp_datetime)
		 VALUES (?, ?, ?, '@login', ?, ?, NOW())`,
        [mbId, LOGIN_XP, `${today} 로그인`, mbId, today]
    );

    // 3. as_exp 증가
    await pool.query(`UPDATE g5_member SET as_exp = as_exp + ? WHERE mb_id = ?`, [LOGIN_XP, mbId]);

    // 4. mb_login_days 증가
    await pool.query(`UPDATE g5_member SET mb_login_days = mb_login_days + 1 WHERE mb_id = ?`, [
        mbId
    ]);

    // 5. 레벨 재계산
    const [memberRows] = await readPool.query<MemberRow[]>(
        `SELECT COALESCE(as_exp, 0) as as_exp, COALESCE(as_level, 0) as as_level, mb_level FROM g5_member WHERE mb_id = ?`,
        [mbId]
    );
    if (memberRows.length > 0) {
        const member = memberRows[0];
        const newLevel = calculateLevel(member.as_exp);
        if (newLevel !== member.as_level) {
            await pool.query(`UPDATE g5_member SET as_level = ? WHERE mb_id = ?`, [newLevel, mbId]);
        }
    }
}

/**
 * 소급 반영용: 특정 날짜의 로그인 XP를 적립 (날짜 지정 + xp_datetime 조정)
 */
export async function grantLoginXPForDate(mbId: string, dateStr: string): Promise<boolean> {
    // 이미 적립했는지 확인
    const [existing] = await readPool.query<ExistingRow[]>(
        `SELECT COUNT(*) as cnt
         FROM g5_na_xp
         WHERE mb_id = ?
           AND xp_rel_table = '@login'
           AND xp_rel_action = ?
         LIMIT 1`,
        [mbId, dateStr]
    );
    if (existing[0]?.cnt > 0) return false;

    // XP 로그 삽입 (해당 날짜 timestamp)
    await pool.query(
        `INSERT INTO g5_na_xp (mb_id, xp_point, xp_content, xp_rel_table, xp_rel_id, xp_rel_action, xp_datetime)
		 VALUES (?, ?, ?, '@login', ?, ?, ?)`,
        [mbId, LOGIN_XP, `${dateStr} 로그인`, mbId, dateStr, `${dateStr} 09:00:00`]
    );

    return true;
}

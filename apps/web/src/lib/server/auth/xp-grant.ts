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

const LOGIN_XP = 500;

// Level thresholds (cumulative exp required for each level) — nariya compatible
// Formula: 1000 * (n-1)² where n = level
// Level 1: 0, Level 2: 1000, Level 3: 4000, Level 10: 81000, Level 40: 1521000
const levelThresholds: number[] = [];
for (let n = 1; n <= 110; n++) {
    levelThresholds.push(1000 * (n - 1) * (n - 1));
}

interface ExistingRow extends RowDataPacket {
    cnt: number;
}

interface MemberRow extends RowDataPacket {
    as_exp: number;
    as_level: number;
    mb_level: number;
}

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

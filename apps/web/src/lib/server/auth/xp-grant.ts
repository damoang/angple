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

// Level thresholds (cumulative exp required for each level) — synced with backend
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
        `SELECT COUNT(*) as cnt FROM g5_na_xp WHERE mb_id = ? AND xp_rel_action = ? LIMIT 1`,
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
        // mb_level도 동기화 (as_level이 더 높으면 올려줌)
        if (newLevel > member.mb_level) {
            await pool.query(
                `UPDATE g5_member SET mb_level = GREATEST(mb_level, ?) WHERE mb_id = ?`,
                [newLevel, mbId]
            );
        }
    }
}

/**
 * 소급 반영용: 특정 날짜의 로그인 XP를 적립 (날짜 지정 + xp_datetime 조정)
 */
export async function grantLoginXPForDate(mbId: string, dateStr: string): Promise<boolean> {
    // 이미 적립했는지 확인
    const [existing] = await readPool.query<ExistingRow[]>(
        `SELECT COUNT(*) as cnt FROM g5_na_xp WHERE mb_id = ? AND xp_rel_action = ? LIMIT 1`,
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

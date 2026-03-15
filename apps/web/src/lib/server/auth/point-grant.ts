/**
 * 로그인 포인트 적립 (SvelteKit DB 직접 처리)
 *
 * OAuth 및 소셜 로그인 시 호출하여 일일 첫 로그인 포인트를 적립합니다.
 * PHP의 "첫로그인" 100P 지급 로직을 SvelteKit에서 구현합니다.
 *
 * - 하루 1회 100P (중복 방지)
 * - mb_point 증가
 */
import pool, { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

const LOGIN_POINT = 100;

interface ExistingRow extends RowDataPacket {
    cnt: number;
}

interface MemberPointRow extends RowDataPacket {
    mb_point: number;
}

/**
 * 로그인 포인트 적립 (첫로그인 100P)
 * @param mbId 회원 ID
 */
export async function grantLoginPoint(mbId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // "2026-03-15"

    // 1. 오늘 이미 적립했는지 확인 (중복 방지)
    const [existing] = await readPool.query<ExistingRow[]>(
        `SELECT COUNT(*) as cnt FROM g5_point WHERE mb_id = ? AND po_rel_table = '@login' AND po_rel_action = ? LIMIT 1`,
        [mbId, today]
    );
    if (existing[0]?.cnt > 0) return;

    // 2. 현재 포인트 조회 (po_mb_point 기록용)
    const [memberRows] = await readPool.query<MemberPointRow[]>(
        `SELECT mb_point FROM g5_member WHERE mb_id = ?`,
        [mbId]
    );
    const currentPoint = memberRows[0]?.mb_point ?? 0;
    const newPoint = currentPoint + LOGIN_POINT;

    // 3. 포인트 로그 삽입
    await pool.query(
        `INSERT INTO g5_point (mb_id, po_content, po_point, po_use_point, po_mb_point, po_rel_table, po_rel_id, po_rel_action, po_expired, po_expire_date, po_datetime)
		 VALUES (?, ?, ?, 0, ?, '@login', ?, ?, 0, '9999-12-31', NOW())`,
        [mbId, `${today} 첫로그인`, LOGIN_POINT, newPoint, mbId, today]
    );

    // 4. mb_point 증가
    await pool.query(`UPDATE g5_member SET mb_point = mb_point + ? WHERE mb_id = ?`, [
        LOGIN_POINT,
        mbId
    ]);
}

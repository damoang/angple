/**
 * 회원 탈퇴 여부 서버사이드 배치 조회 (SSR용)
 *
 * mb_id 배열로 g5_member.mb_leave_date를 배치 조회.
 * mb_leave_date != '' 인 회원만 true로 반환.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_IDS = 200;

/**
 * 탈퇴 회원 ID Set 반환
 * @param ids mb_id 배열
 * @returns 탈퇴한 mb_id Set (탈퇴자만 포함)
 */
export async function fetchWithdrawnMemberIds(ids: string[]): Promise<Set<string>> {
    const validIds = ids.filter((id) => id && /^[a-zA-Z0-9_]+$/.test(id)).slice(0, MAX_IDS);

    if (validIds.length === 0) return new Set();

    const placeholders = validIds.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id FROM g5_member WHERE mb_id IN (${placeholders}) AND mb_leave_date != ''`,
        validIds
    );

    const withdrawn = new Set<string>();
    for (const row of rows) {
        withdrawn.add(row.mb_id);
    }
    return withdrawn;
}

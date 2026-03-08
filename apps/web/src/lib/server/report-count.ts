/**
 * 게시글 신고 횟수(wr_7) 조회 (관리자 SSR용)
 *
 * wr_7 컬럼은 g5_write_{boardId} 테이블에 저장되며,
 * 숫자(신고 횟수) 또는 "lock"(신고 잠금) 값을 가짐.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface Wr7Row extends RowDataPacket {
    wr_7: string | null;
}

export async function fetchPostReportCount(
    boardId: string,
    postId: number
): Promise<number | string | null> {
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const tableName = `g5_write_${safeBoardId}`;

    const [rows] = await pool.query<Wr7Row[]>(`SELECT wr_7 FROM ?? WHERE wr_id = ? LIMIT 1`, [
        tableName,
        postId
    ]);

    const wr7 = rows[0]?.wr_7;
    if (!wr7) return null;
    if (wr7 === 'lock') return 'lock';
    const num = parseInt(wr7, 10);
    return num > 0 ? num : null;
}

/**
 * 삭제 예약 게시글 서버사이드 배치 조회 (SSR용)
 *
 * g5_scheduled_deletes 테이블에서 pending 상태 레코드만 조회해
 * (wr_id → scheduled_at) 매핑을 반환한다. 목록에서 "삭제예정" 뱃지
 * 표시에 사용.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_IDS = 500;

interface ScheduledRow extends RowDataPacket {
    wr_id: number;
    scheduled_at: string;
}

/**
 * @param boardId bo_table 값
 * @param postIds wr_id 숫자 배열
 * @returns Map<wr_id, scheduled_at ISO string>
 */
export async function fetchScheduledDeletes(
    boardId: string,
    postIds: number[]
): Promise<Map<number, string>> {
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const validIds = postIds.filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_IDS);

    if (!safeBoardId || validIds.length === 0) return new Map();

    const placeholders = validIds.map(() => '?').join(',');
    const [rows] = await pool.query<ScheduledRow[]>(
        `SELECT wr_id, scheduled_at FROM g5_scheduled_deletes
         WHERE bo_table = ? AND wr_id IN (${placeholders})
           AND wr_is_comment = 0 AND status = 'pending'`,
        [safeBoardId, ...validIds]
    );

    const result = new Map<number, string>();
    for (const row of rows) {
        const val = row.scheduled_at;
        if (val) result.set(Number(row.wr_id), String(val));
    }
    return result;
}

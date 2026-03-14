/**
 * 진실의방(truthroom) 서버 모듈
 * - 잠긴 게시글/댓글 → 진실의방 참조 글 ID 조회
 */
import { pool } from '$lib/server/db.js';

interface TruthroomRow {
    wr_id: number;
    wr_1: string;
    wr_2: string;
    wr_3: string;
}

/**
 * 잠긴 게시글의 진실의방 참조 글 ID 조회
 */
export async function fetchTruthroomPostId(
    boardId: string,
    postId: string | number
): Promise<number | null> {
    try {
        const [rows] = await pool.query<TruthroomRow[]>(
            `SELECT wr_id FROM g5_write_truthroom
			 WHERE wr_1 = ? AND wr_2 = ? AND wr_3 = '' AND wr_is_comment = 0
			 ORDER BY wr_id DESC LIMIT 1`,
            [boardId, String(postId)]
        );
        return rows.length > 0 ? rows[0].wr_id : null;
    } catch {
        return null;
    }
}

/**
 * 잠긴 댓글들의 진실의방 매핑 배치 조회
 * @returns { [commentId]: truthroomPostId }
 */
export async function fetchTruthroomCommentMap(
    boardId: string,
    parentId: string | number,
    commentIds: number[]
): Promise<Record<number, number>> {
    if (!commentIds.length) return {};
    try {
        const placeholders = commentIds.map(() => '?').join(',');
        const [rows] = await pool.query<TruthroomRow[]>(
            `SELECT wr_id, wr_3 FROM g5_write_truthroom
			 WHERE wr_1 = ? AND wr_2 = ? AND wr_3 IN (${placeholders}) AND wr_is_comment = 0`,
            [boardId, String(parentId), ...commentIds.map(String)]
        );
        const map: Record<number, number> = {};
        for (const row of rows) {
            const cid = Number(row.wr_3);
            if (cid > 0) map[cid] = row.wr_id;
        }
        return map;
    } catch {
        return {};
    }
}

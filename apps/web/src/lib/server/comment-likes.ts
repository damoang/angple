/**
 * 댓글 좋아요/비추천 상태 배치 조회 (SSR용)
 *
 * g5_board_good 테이블에서 현재 사용자의 댓글 추천/비추천 상태를 일괄 조회
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface GoodRow extends RowDataPacket {
    wr_id: number;
    bg_flag: string;
}

export interface CommentLikeStatuses {
    likedIds: number[];
    dislikedIds: number[];
}

/**
 * 댓글 좋아요/비추천 상태 배치 조회
 * @param boardId 게시판 ID
 * @param commentIds 댓글 ID 배열
 * @param userId 현재 사용자 mb_id
 */
export async function fetchCommentLikeStatuses(
    boardId: string,
    commentIds: number[],
    userId: string
): Promise<CommentLikeStatuses> {
    if (!commentIds.length || !userId) {
        return { likedIds: [], dislikedIds: [] };
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const placeholders = commentIds.map(() => '?').join(',');

    const [rows] = await pool.query<GoodRow[]>(
        `SELECT wr_id, bg_flag FROM g5_board_good
         WHERE bo_table = ? AND wr_id IN (${placeholders}) AND mb_id = ?`,
        [safeBoardId, ...commentIds, userId]
    );

    const likedIds: number[] = [];
    const dislikedIds: number[] = [];

    for (const row of rows) {
        if (row.bg_flag === 'good') likedIds.push(row.wr_id);
        if (row.bg_flag === 'nogood') dislikedIds.push(row.wr_id);
    }

    return { likedIds, dislikedIds };
}

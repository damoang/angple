/**
 * 게시글 추천/비추천 상태 조회 (SSR용)
 *
 * g5_board_good 테이블에서 현재 사용자의 게시글 추천/비추천 상태를 조회
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface GoodRow extends RowDataPacket {
    bg_flag: string;
}

export interface PostLikeStatus {
    userLiked: boolean;
    userDisliked: boolean;
}

/**
 * 게시글 추천/비추천 상태 조회
 * @param boardId 게시판 ID
 * @param postId 게시글 ID
 * @param userId 현재 사용자 mb_id
 */
export async function fetchPostLikeStatus(
    boardId: string,
    postId: number,
    userId: string
): Promise<PostLikeStatus> {
    if (!userId) {
        return { userLiked: false, userDisliked: false };
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');

    const [rows] = await pool.query<GoodRow[]>(
        `SELECT bg_flag FROM g5_board_good
         WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
        [safeBoardId, postId, userId]
    );

    let userLiked = false;
    let userDisliked = false;

    for (const row of rows) {
        if (row.bg_flag === 'good') userLiked = true;
        if (row.bg_flag === 'nogood') userDisliked = true;
    }

    return { userLiked, userDisliked };
}

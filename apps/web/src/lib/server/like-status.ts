/**
 * 게시글 추천 상태 서버사이드 조회 (SSR용)
 *
 * /api/boards/[boardId]/posts/[postId]/like GET 핸들러의 DB 로직 추출.
 * +page.server.ts에서 SSR 스트리밍으로 직접 호출하여 CDN 요청 제거.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface GoodRow extends RowDataPacket {
    bg_flag: string;
}

interface WriteRow extends RowDataPacket {
    wr_good: number;
    wr_nogood: number;
}

export interface LikeStatus {
    likes: number;
    dislikes: number;
    user_liked: boolean;
    user_disliked: boolean;
}

/**
 * 게시글 추천 상태 조회
 * @param boardId 게시판 ID
 * @param postId 게시글 ID
 * @param memberId 로그인한 사용자 mb_id (없으면 빈 문자열)
 */
export async function fetchLikeStatus(
    boardId: string,
    postId: number,
    memberId: string = ''
): Promise<LikeStatus> {
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const tableName = `g5_write_${safeBoardId}`;

    const [writeRows] = await pool.query<WriteRow[]>(
        `SELECT wr_good, wr_nogood FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
        [tableName, postId]
    );

    if (!writeRows[0]) {
        return { likes: 0, dislikes: 0, user_liked: false, user_disliked: false };
    }

    const likes = writeRows[0].wr_good;
    const dislikes = writeRows[0].wr_nogood;

    let userLiked = false;
    let userDisliked = false;

    if (memberId) {
        const [goodRows] = await pool.query<GoodRow[]>(
            `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
            [safeBoardId, postId, memberId]
        );

        for (const row of goodRows) {
            if (row.bg_flag === 'good') userLiked = true;
            if (row.bg_flag === 'nogood') userDisliked = true;
        }
    }

    return { likes, dislikes, user_liked: userLiked, user_disliked: userDisliked };
}

/**
 * 댓글 추천자 목록 API
 * GET /api/boards/[boardId]/posts/[postId]/comments/[commentId]/likers
 *
 * g5_board_good 테이블에서 해당 댓글의 추천자 목록 조회
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

interface LikerRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string;
    mb_name: string;
    bg_ip: string;
    bg_datetime: string;
}

interface CountRow extends RowDataPacket {
    total: number;
}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
    const { boardId, commentId } = params;

    if (!boardId || !commentId) {
        return json(
            { success: false, message: 'boardId와 commentId가 필요합니다.' },
            { status: 400 }
        );
    }

    // boardId 유효성 검사
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeCommentId = parseInt(commentId, 10);

    if (isNaN(safeCommentId)) {
        return json({ success: false, message: '유효하지 않은 commentId입니다.' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    try {
        const user = await getAuthUser(cookies);
        const isAuthenticated = !!user;

        // 총 추천자 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM g5_board_good
			 WHERE bo_table = ? AND wr_id = ? AND bg_flag = 'good'`,
            [safeBoardId, safeCommentId]
        );
        const total = countRows[0]?.total ?? 0;

        // 추천자 목록 (최신순)
        const [likerRows] = await pool.query<LikerRow[]>(
            `SELECT g.mb_id, m.mb_nick, m.mb_name, g.bg_ip, g.bg_datetime
			 FROM g5_board_good g
			 JOIN g5_member m ON g.mb_id = m.mb_id
			 WHERE g.bo_table = ? AND g.wr_id = ? AND g.bg_flag = 'good'
			 ORDER BY g.bg_datetime DESC
			 LIMIT ? OFFSET ?`,
            [safeBoardId, safeCommentId, limit, offset]
        );

        const likers = likerRows.map((row) => ({
            mb_id: row.mb_id,
            mb_name: row.mb_name,
            mb_nick: row.mb_nick,
            bg_ip: isAuthenticated ? row.bg_ip || '' : '',
            liked_at: row.bg_datetime
        }));

        return json({
            success: true,
            data: {
                likers,
                total
            }
        });
    } catch (error) {
        console.error('Comment likers GET error:', error);
        return json(
            { success: false, message: '추천자 목록 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

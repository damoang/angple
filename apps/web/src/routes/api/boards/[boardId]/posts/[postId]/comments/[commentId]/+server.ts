/**
 * 댓글 삭제/수정 API (레거시 g5_write_{boardId} 기반)
 *
 * DELETE /api/boards/[boardId]/posts/[postId]/comments/[commentId]
 * PUT /api/boards/[boardId]/posts/[postId]/comments/[commentId]
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface CommentRow extends RowDataPacket {
    wr_id: number;
    mb_id: string;
    wr_comment: number;
    wr_comment_reply: string;
    wr_deleted_at: string | null;
}

/**
 * 댓글 삭제 (soft delete)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
    const { boardId, postId, commentId } = params;
    const userId = locals.user?.id;
    const userLevel = locals.user?.level ?? 0;

    if (!userId) {
        return json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!boardId || !postId || !commentId) {
        return json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeCommentId = parseInt(commentId, 10);
    const safePostId = parseInt(postId, 10);

    if (isNaN(safeCommentId) || isNaN(safePostId)) {
        return json({ error: '잘못된 ID입니다.' }, { status: 400 });
    }

    const tableName = `g5_write_${safeBoardId}`;

    try {
        // 댓글 존재 확인
        const [rows] = await pool.query<CommentRow[]>(
            `SELECT wr_id, mb_id, wr_deleted_at FROM ?? WHERE wr_id = ? AND wr_parent = ? AND wr_is_comment >= 1`,
            [tableName, safeCommentId, safePostId]
        );

        if (!rows[0]) {
            return json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
        }

        if (rows[0].wr_deleted_at) {
            return json({ error: '이미 삭제된 댓글입니다.' }, { status: 400 });
        }

        // 권한 확인: 본인 또는 관리자
        if (rows[0].mb_id !== userId && userLevel < 10) {
            return json({ error: '본인이 작성한 댓글만 삭제할 수 있습니다.' }, { status: 403 });
        }

        // soft delete
        await pool.query(`UPDATE ?? SET wr_deleted_at = NOW(), wr_deleted_by = ? WHERE wr_id = ?`, [
            tableName,
            userId,
            safeCommentId
        ]);

        // 알림에 남은 본문 스니펫 소거.
        // soft delete 는 wr_content 를 지우지 않고 렌더링에서 가리는 방식이라,
        // g5_na_noti.rel_msg 에 복사돼 있던 본문이 수신자 알림함에 그대로 남는다.
        // (2026-07-20 실측: 삭제된 댓글의 원문이 30명 알림함에 119건 잔존 → 백필로 소거)
        // 파생 표면을 함께 지우지 않으면 soft delete 는 무의미해진다.
        // rel_bo_table/rel_wr_id 쌍이 본문 스니펫을 담는다(bo_table/wr_id 쌍은 "○○님이
        // 댓글을 남겼습니다" 안내 문구라 대상 아님).
        await pool
            .query(
                `UPDATE g5_na_noti SET rel_msg = ''
                  WHERE rel_bo_table = ? AND rel_wr_id = ? AND rel_msg <> ''`,
                [safeBoardId, safeCommentId]
            )
            .catch((err) => {
                // 알림 정리 실패가 삭제 자체를 되돌리면 안 된다 — 로그만 남긴다.
                console.error('Comment DELETE: notification snippet cleanup failed:', err);
            });

        return json({ message: '삭제 완료' });
    } catch (error) {
        console.error('Comment DELETE error:', error);
        return json({ error: '댓글 삭제에 실패했습니다.' }, { status: 500 });
    }
};

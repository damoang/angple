/**
 * 게시글 공지 고정/해제 API
 * PATCH /api/boards/[boardId]/posts/[postId]/notice
 * 관리자(mb_level >= 10)만 사용 가능
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
    const { boardId, postId } = params;

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 관리자만 공지 설정 가능
    if (user.mb_level < 10) {
        return json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const noticeType = body.notice_type as string | null;

        // 게시글 존재 확인
        const tableName = `g5_write_${boardId}`;
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_id FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
            [tableName, postId]
        );

        if (!rows[0]) {
            return json({ success: false, error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
        }

        // g5_board.bo_notice에서 현재 공지 목록 조회
        const [boardRows] = await pool.query<RowDataPacket[]>(
            `SELECT bo_notice FROM g5_board WHERE bo_table = ?`,
            [boardId]
        );

        if (!boardRows[0]) {
            return json({ success: false, error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
        }

        const currentNotice = (boardRows[0].bo_notice as string) || '';
        const noticeIds = currentNotice
            .split(',')
            .map((id: string) => id.trim())
            .filter((id: string) => id !== '' && id !== postId);

        if (noticeType) {
            // 공지 추가
            noticeIds.push(String(postId));
        }
        // noticeType이 null이면 제거만 (이미 filter에서 제거됨)

        const newNotice = noticeIds.join(',');

        await pool.query(`UPDATE g5_board SET bo_notice = ? WHERE bo_table = ?`, [
            newNotice,
            boardId
        ]);

        return json({ success: true, data: { notice_type: noticeType } });
    } catch (error) {
        console.error('Notice API error:', error);
        return json({ success: false, error: '공지 설정에 실패했습니다.' }, { status: 500 });
    }
};

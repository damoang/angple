/**
 * 게시글 공지 고정/해제 API
 * PATCH /api/boards/[boardId]/posts/[postId]/notice
 *
 * 권한: 사이트 관리자(mb_level >= 10) 또는 **그 소모임의 당주**(g5_board.bo_admin).
 * 당주는 자기 소모임 하나에만 권한이 있다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getBoardOwnerContext } from '$lib/server/board-owner';

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
    const { boardId, postId } = params;

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 사이트 관리자 또는 그 소모임의 당주(g5_board.bo_admin)만 공지를 고정할 수 있다.
    // 당주에게 열어주는 이유: 지금까지 소모임 공지 하나 고정하려 해도 운영진에게
    // 요청해야 했다. 권한은 자기 소모임 하나로 한정된다(getBoardOwnerContext 가 검사).
    if (user.mb_level < 10) {
        const ctx = await getBoardOwnerContext(boardId, user);
        if (!ctx) {
            return json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
        }
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

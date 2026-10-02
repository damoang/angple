/**
 * 게시글 상태 변경 API (중고게시판)
 * PATCH /api/boards/[boardId]/posts/[postId]/status
 * 판매중 → 예약중 → 판매완료 상태 변경
 *
 * 판정 순서: 401(비로그인) → 404(허용 게시판 아님) → 400(postId) → 400(상태값) → 403(작성자·관리자 아님)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { isTradeStatusBoard, parsePostId } from '$lib/server/trade-status-guard';

const VALID_STATUSES = ['selling', 'reserved', 'sold'] as const;

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
    const { boardId } = params;

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 허용 게시판이 아니면 DB 를 조회·쓰기 전에 거절한다 (wr_2 는 게시판마다 용도가 다르다)
    if (!isTradeStatusBoard(boardId)) {
        return json({ success: false, error: '찾을 수 없습니다.' }, { status: 404 });
    }

    const postId = parsePostId(params.postId);
    if (postId === null) {
        return json({ success: false, error: '잘못된 게시글 번호입니다.' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const newStatus = body.status as string;

        if (!VALID_STATUSES.includes(newStatus as (typeof VALID_STATUSES)[number])) {
            return json({ success: false, error: '유효하지 않은 상태입니다.' }, { status: 400 });
        }

        // 글 작성자 확인
        const tableName = `g5_write_${boardId}`;
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT mb_id FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
            [tableName, postId]
        );

        if (!rows[0]) {
            return json({ success: false, error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 글 작성자 또는 관리자만 변경 가능
        if (rows[0].mb_id !== user.mb_id && user.mb_level < 10) {
            return json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
        }

        // wr_2 필드에 상태 저장 (중고게시판은 extra_2 = status)
        await pool.query(`UPDATE ?? SET wr_2 = ? WHERE wr_id = ?`, [tableName, newStatus, postId]);

        return json({ success: true, data: { status: newStatus } });
    } catch (error) {
        console.error('Market status API error:', error);
        return json({ success: false, error: '상태 변경에 실패했습니다.' }, { status: 500 });
    }
};

/**
 * 게시판 구독 API
 * GET    /api/boards/[boardId]/subscribe — 구독 상태 조회
 * POST   /api/boards/[boardId]/subscribe — 구독
 * DELETE /api/boards/[boardId]/subscribe — 구독 해제
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { isInternalAppRequest } from '$lib/server/internal-api.js';

interface SubRow extends RowDataPacket {
    id: number;
}

interface CountRow extends RowDataPacket {
    count: number;
}

/** GET: 구독 상태 + 구독자 수 */
export const GET: RequestHandler = async ({ params, cookies, request }) => {
    const boardId = params.boardId?.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!boardId) {
        return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
    }

    try {
        const isInternalRequest = isInternalAppRequest(request);
        const user = isInternalRequest ? await getAuthUser(cookies) : null;
        let isSubscribed = false;

        if (user) {
            const [rows] = await pool.query<SubRow[]>(
                'SELECT id FROM g5_board_subscribe WHERE mb_id = ? AND bo_table = ?',
                [user.mb_id, boardId]
            );
            isSubscribed = rows.length > 0;
        }

        const [countRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_board_subscribe WHERE bo_table = ?',
            [boardId]
        );

        return json({
            success: true,
            data: {
                is_subscribed: isSubscribed,
                subscriber_count: countRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Subscribe GET error:', error);
        return json({ success: false, message: '구독 상태 조회에 실패했습니다.' }, { status: 500 });
    }
};

/** POST: 구독 */
export const POST: RequestHandler = async ({ params, cookies }) => {
    const boardId = params.boardId?.replace(/[^a-zA-Z0-9_-]/g, '');
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!boardId) {
        return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
    }

    try {
        await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO g5_board_subscribe (mb_id, bo_table) VALUES (?, ?)',
            [user.mb_id, boardId]
        );

        const [countRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_board_subscribe WHERE bo_table = ?',
            [boardId]
        );

        return json({
            success: true,
            data: {
                is_subscribed: true,
                subscriber_count: countRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Subscribe POST error:', error);
        return json({ success: false, message: '구독에 실패했습니다.' }, { status: 500 });
    }
};

/** DELETE: 구독 해제 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
    const boardId = params.boardId?.replace(/[^a-zA-Z0-9_-]/g, '');
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!boardId) {
        return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
    }

    try {
        await pool.query('DELETE FROM g5_board_subscribe WHERE mb_id = ? AND bo_table = ?', [
            user.mb_id,
            boardId
        ]);

        const [countRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_board_subscribe WHERE bo_table = ?',
            [boardId]
        );

        return json({
            success: true,
            data: {
                is_subscribed: false,
                subscriber_count: countRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Subscribe DELETE error:', error);
        return json({ success: false, message: '구독 해제에 실패했습니다.' }, { status: 500 });
    }
};

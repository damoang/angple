/**
 * 내가 구독한 게시판 목록
 * GET /api/my/subscriptions
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

interface SubRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
}

export const GET: RequestHandler = async ({ cookies }) => {
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const [rows] = await pool.query<SubRow[]>(
            `SELECT s.bo_table, b.bo_subject
			 FROM g5_board_subscribe s
			 JOIN g5_board b ON s.bo_table = b.bo_table
			 WHERE s.mb_id = ?
			 ORDER BY s.id DESC`,
            [user.mb_id]
        );

        return json({
            success: true,
            data: rows.map((r) => ({
                board_id: r.bo_table,
                board_name: r.bo_subject
            }))
        });
    } catch (error) {
        console.error('My subscriptions error:', error);
        return json({ success: false, message: '구독 목록 조회에 실패했습니다.' }, { status: 500 });
    }
};

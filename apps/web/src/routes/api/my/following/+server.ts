/**
 * 내가 팔로우한 회원 목록
 * GET /api/my/following
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

interface FollowRow extends RowDataPacket {
    target_id: string;
    mb_name: string;
    mb_nick: string;
}

export const GET: RequestHandler = async ({ cookies }) => {
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const [rows] = await pool.query<FollowRow[]>(
            `SELECT f.target_id, m.mb_name, m.mb_nick
			 FROM g5_member_follow f
			 JOIN g5_member m ON f.target_id COLLATE utf8mb4_unicode_ci = m.mb_id
			 WHERE f.mb_id = ?
			 ORDER BY f.id DESC`,
            [user.mb_id]
        );

        return json({
            success: true,
            data: rows.map((r) => ({
                mb_id: r.target_id,
                mb_name: r.mb_name,
                mb_nick: r.mb_nick || r.mb_name
            }))
        });
    } catch (error) {
        console.error('My following error:', error);
        return json(
            { success: false, message: '팔로우 목록 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

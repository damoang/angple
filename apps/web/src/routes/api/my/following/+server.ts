/**
 * 내 팔로잉 회원 목록 API
 * GET /api/my/following
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';
import { getAuthUser } from '$lib/server/auth';

interface FollowMemberRow extends RowDataPacket {
    mb_id: string;
    mb_name: string;
    mb_nick: string;
}

export const GET: RequestHandler = async ({ cookies }) => {
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const [rows] = await readPool.query<FollowMemberRow[]>(
            `SELECT f.target_id AS mb_id, m.mb_name, m.mb_nick
			 FROM g5_member_follow f
			 JOIN g5_member m ON f.target_id = m.mb_id
			 WHERE f.mb_id = ?
			 ORDER BY f.created_at DESC`,
            [user.mb_id]
        );

        return json({
            success: true,
            data: rows.map((r) => ({
                mb_id: r.mb_id,
                mb_name: r.mb_name,
                mb_nick: r.mb_nick
            }))
        });
    } catch (error) {
        console.error('[My Following API] error:', error);
        return json(
            { success: false, message: '팔로잉 목록 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

/**
 * 팔로워 목록 API
 * GET /api/members/[id]/followers?limit=50
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';

interface FollowerRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string;
    mb_image_url: string;
    mb_image_updated_at: string;
    mb_level: number;
    followed_at: string;
}

interface CountRow extends RowDataPacket {
    count: number;
}

export const GET: RequestHandler = async ({ params }) => {
    const targetId = params.id;

    if (!targetId || !/^[a-zA-Z0-9_]+$/.test(targetId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    try {
        const [countRows] = await readPool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
            [targetId]
        );
        const total = countRows[0]?.count ?? 0;

        const [rows] = await readPool.query<FollowerRow[]>(
            `SELECT f.mb_id, m.mb_nick, m.mb_image_url, m.mb_image_updated_at, m.mb_level, f.created_at as followed_at
			 FROM g5_member_follow f
			 JOIN g5_member m ON f.mb_id = m.mb_id
			 WHERE f.target_id = ?
			 ORDER BY f.created_at DESC
			 LIMIT 50`,
            [targetId]
        );

        return json({
            success: true,
            data: {
                total,
                followers: rows.map((r) => ({
                    mb_id: r.mb_id,
                    mb_nick: r.mb_nick,
                    mb_image: r.mb_image_url || '',
                    mb_image_updated_at: r.mb_image_updated_at || '',
                    mb_level: r.mb_level,
                    followed_at: r.followed_at
                }))
            }
        });
    } catch (error) {
        console.error('[Followers API] error:', error);
        return json({ success: false, error: '팔로워 조회에 실패했습니다.' }, { status: 500 });
    }
};

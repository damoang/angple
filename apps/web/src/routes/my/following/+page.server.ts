import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';

interface FollowingRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string;
    mb_level: number;
    mb_image: string;
    followed_at: string;
}

export const load: PageServerLoad = async ({ parent }) => {
    const { user } = await parent();

    try {
        const [rows] = await readPool.query<FollowingRow[]>(
            `SELECT f.target_id AS mb_id, m.mb_nick, m.mb_level,
					COALESCE(m.mb_image, '') AS mb_image,
					f.created_at AS followed_at
			 FROM g5_member_follow f
			 JOIN g5_member m
			   ON f.target_id COLLATE utf8mb4_unicode_ci = m.mb_id COLLATE utf8mb4_unicode_ci
			 WHERE f.mb_id COLLATE utf8mb4_unicode_ci = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
			 ORDER BY f.created_at DESC`,
            [user.mb_id]
        );

        return {
            following: rows.map((r) => ({
                mb_id: r.mb_id,
                mb_nick: r.mb_nick,
                mb_level: r.mb_level,
                mb_image: r.mb_image,
                followed_at: r.followed_at
            }))
        };
    } catch (error) {
        console.error('[My Following] load error:', error);
        return {
            following: [],
            error: '팔로잉 목록을 불러오지 못했습니다.'
        };
    }
};

import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';

interface FollowingRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string;
    mb_level: number;
    followed_at: string;
}

export const load: PageServerLoad = async ({ parent }) => {
    const { user } = await parent();

    try {
        const [rows] = await readPool.query<FollowingRow[]>(
            // ⛔ g5_member 에 mb_image 컬럼은 없다(실제로는 mb_image_url/_exists/_updated_at).
            //    화면에서 쓰지도 않는 컬럼을 select 하다 쿼리 전체가 ER_BAD_FIELD_ERROR 로 실패했고,
            //    catch 가 빈 배열을 돌려주어 "팔로우한 사람 없음"처럼 보였다. 필요한 필드만 조회한다.
            `SELECT f.target_id AS mb_id, m.mb_nick, m.mb_level,
					f.created_at AS followed_at
			 FROM g5_member_follow f
			 JOIN g5_member m
			   ON f.target_id COLLATE utf8mb4_unicode_ci = m.mb_id COLLATE utf8mb4_unicode_ci
			 WHERE f.mb_id COLLATE utf8mb4_unicode_ci = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
			 ORDER BY f.created_at DESC`,
            [user.id]
        );

        return {
            following: rows.map((r) => ({
                mb_id: r.mb_id,
                mb_nick: r.mb_nick,
                mb_level: r.mb_level,
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

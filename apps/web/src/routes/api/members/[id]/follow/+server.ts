/**
 * 회원 팔로우 API
 * GET    /api/members/[id]/follow — 팔로우 상태 조회
 * POST   /api/members/[id]/follow — 팔로우
 * DELETE /api/members/[id]/follow — 언팔로우
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser, isRestrictedUser } from '$lib/server/auth';

interface FollowRow extends RowDataPacket {
    id: number;
}

interface CountRow extends RowDataPacket {
    count: number;
}

/** GET: 팔로우 상태 + 팔로워/팔로잉 수 */
export const GET: RequestHandler = async ({ params, cookies }) => {
    const targetId = params.id;
    if (!targetId) {
        return json({ success: false, message: 'id가 필요합니다.' }, { status: 400 });
    }

    try {
        const user = await getAuthUser(cookies);
        let isFollowing = false;

        if (user) {
            const [rows] = await pool.query<FollowRow[]>(
                'SELECT id FROM g5_member_follow WHERE mb_id = ? AND target_id = ?',
                [user.mb_id, targetId]
            );
            isFollowing = rows.length > 0;
        }

        const [followerRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
            [targetId]
        );
        const [followingRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE mb_id = ?',
            [targetId]
        );

        return json({
            success: true,
            data: {
                is_following: isFollowing,
                follower_count: followerRows[0]?.count ?? 0,
                following_count: followingRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Follow GET error:', error);
        return json(
            { success: false, message: '팔로우 상태 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

/** POST: 팔로우 */
export const POST: RequestHandler = async ({ params, cookies }) => {
    const targetId = params.id;
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (isRestrictedUser(user)) {
        return json(
            { success: false, message: '이용제한 중에는 이 기능을 사용할 수 없습니다.' },
            { status: 403 }
        );
    }

    if (!targetId || targetId === user.mb_id) {
        return json({ success: false, message: '자신을 팔로우할 수 없습니다.' }, { status: 400 });
    }

    try {
        await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO g5_member_follow (mb_id, target_id) VALUES (?, ?)',
            [user.mb_id, targetId]
        );

        const [followerRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
            [targetId]
        );

        return json({
            success: true,
            data: {
                is_following: true,
                follower_count: followerRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Follow POST error:', error);
        return json({ success: false, message: '팔로우에 실패했습니다.' }, { status: 500 });
    }
};

/** DELETE: 언팔로우 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
    const targetId = params.id;
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (isRestrictedUser(user)) {
        return json(
            { success: false, message: '이용제한 중에는 이 기능을 사용할 수 없습니다.' },
            { status: 403 }
        );
    }

    if (!targetId) {
        return json({ success: false, message: 'id가 필요합니다.' }, { status: 400 });
    }

    try {
        await pool.query('DELETE FROM g5_member_follow WHERE mb_id = ? AND target_id = ?', [
            user.mb_id,
            targetId
        ]);

        const [followerRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
            [targetId]
        );

        return json({
            success: true,
            data: {
                is_following: false,
                follower_count: followerRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Follow DELETE error:', error);
        return json({ success: false, message: '언팔로우에 실패했습니다.' }, { status: 500 });
    }
};

/**
 * 팔로워 목록 API
 * GET /api/members/[id]/followers?limit=50
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';
import { isWithdrawnMember } from '../_withdrawn';
import { calculateLevelFromExp } from '$lib/utils/level-thresholds';

interface FollowerRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string;
    mb_image_url: string;
    mb_image_updated_at: string;
    mb_level: number;
    // XP 배지용. ⛔ 저장된 as_level 이 아니라 as_exp 를 읽어 계산한다 —
    //    다른 화면과 같은 규칙을 쓰기 위해서다(bug/13149).
    as_exp: number;
    followed_at: string;
}

interface CountRow extends RowDataPacket {
    count: number;
}

export const GET: RequestHandler = async ({ params, locals }) => {
    // ⛔ 2026-08-08 개인정보 전수점검: 무인증 팔로우그래프 열람 차단(profile 게이트와 동일, #12501).
    if (!locals.user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const targetId = params.id;

    if (!targetId || !/^[a-zA-Z0-9_-]+$/.test(targetId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    // 탈퇴 회원 팔로워 목록 비노출 (개인정보 분쟁조정 대응)
    if (await isWithdrawnMember(targetId)) {
        return json({ success: true, data: { total: 0, followers: [] } });
    }

    try {
        const [countRows] = await readPool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
            [targetId]
        );
        const total = countRows[0]?.count ?? 0;

        const [rows] = await readPool.query<FollowerRow[]>(
            `SELECT f.mb_id, m.mb_nick, m.mb_image_url, m.mb_image_updated_at, m.mb_level, m.as_exp, f.created_at as followed_at
			 FROM g5_member_follow f
			 JOIN g5_member m ON f.mb_id COLLATE utf8mb4_unicode_ci = m.mb_id COLLATE utf8mb4_unicode_ci
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
                    as_level: calculateLevelFromExp(Number(r.as_exp) || 0),
                    followed_at: r.followed_at
                }))
            }
        });
    } catch (error) {
        console.error('[Followers API] error:', error);
        return json({ success: false, error: '팔로워 조회에 실패했습니다.' }, { status: 500 });
    }
};

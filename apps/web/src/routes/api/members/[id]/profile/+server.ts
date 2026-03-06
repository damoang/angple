/**
 * 회원 공개 프로필 API
 * GET /api/members/[id]/profile
 *
 * g5_member 테이블에서 공개 가능한 정보만 조회
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface MemberRow extends RowDataPacket {
    mb_id: string;
    mb_name: string;
    mb_nick: string;
    mb_level: number;
    mb_signature: string;
    mb_homepage: string;
    mb_datetime: string;
    mb_today_login: string;
    mb_image: string;
}

interface CountRow extends RowDataPacket {
    count: number;
}

export const GET: RequestHandler = async ({ params }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    try {
        const [rows] = await pool.execute<MemberRow[]>(
            `SELECT mb_id, mb_name, mb_nick, mb_level, mb_signature, mb_homepage,
			        mb_datetime, mb_today_login, mb_image
			 FROM g5_member
			 WHERE mb_id = ? AND mb_leave_date = '' AND mb_intercept_date = ''`,
            [memberId]
        );

        if (rows.length === 0) {
            return json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
        }

        const member = rows[0];

        // 글/댓글 수 조회 (g5_board_new 기반)
        const [postCount] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS count FROM g5_board_new WHERE mb_id = ? AND wr_is_comment = 0`,
            [memberId]
        );
        const [commentCount] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS count FROM g5_board_new WHERE mb_id = ? AND wr_is_comment = 1`,
            [memberId]
        );

        // 이미지 URL 처리
        let imageUrl = '';
        if (member.mb_image) {
            imageUrl = member.mb_image.startsWith('http')
                ? member.mb_image
                : `/data/member/${memberId}.gif`;
        }

        return json({
            success: true,
            data: {
                mb_id: member.mb_id,
                mb_name: member.mb_nick || member.mb_name,
                mb_level: member.mb_level,
                mb_image: imageUrl,
                mb_signature: member.mb_signature || '',
                mb_homepage: member.mb_homepage || '',
                mb_datetime: member.mb_datetime,
                mb_today_login: member.mb_today_login || '',
                post_count: postCount[0]?.count ?? 0,
                comment_count: commentCount[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('[Member Profile API] error:', error);
        return json({ success: false, error: '프로필 조회에 실패했습니다.' }, { status: 500 });
    }
};

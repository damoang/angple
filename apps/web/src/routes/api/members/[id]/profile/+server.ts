/**
 * 회원 공개 프로필 API
 * GET /api/members/[id]/profile
 *
 * PHP profile.php와 동일한 정보를 반환
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
    mb_point: number;
    mb_signature: string;
    mb_homepage: string;
    mb_profile: string;
    mb_datetime: string;
    mb_today_login: string;
    mb_nick_date: string;
    mb_image_url: string;
    mb_certify: string;
    mb_leave_date: string;
    as_level: number;
    as_exp: number;
    as_max: number;
}

interface StatsRow extends RowDataPacket {
    total_post_count: number;
    delete_post_count: number;
    total_comment_count: number;
    delete_comment_count: number;
    delete_post_by_admin: number;
    delete_comment_by_admin: number;
    total_rcmd_count: number;
    total_singo_count: number;
}

interface DisciplineRow extends RowDataPacket {
    penalty_period: number;
    penalty_date_from: string;
}

interface CountRow extends RowDataPacket {
    count: number;
    days: number;
}

export const GET: RequestHandler = async ({ params }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    try {
        const [rows] = await pool.execute<MemberRow[]>(
            `SELECT mb_id, mb_name, mb_nick, mb_level, mb_point,
			        mb_signature, mb_homepage, mb_profile,
			        mb_datetime, mb_today_login, mb_nick_date,
			        mb_image_url, mb_certify, mb_leave_date,
			        as_level, as_exp, as_max
			 FROM g5_member
			 WHERE mb_id = ?`,
            [memberId]
        );

        if (rows.length === 0) {
            return json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
        }

        const member = rows[0];
        const isLeft = !!member.mb_leave_date;

        // 가입 후 경과일
        const [daysRows] = await pool.query<CountRow[]>(`SELECT DATEDIFF(NOW(), ?) + 1 AS days`, [
            member.mb_datetime
        ]);
        const regDays = daysRows[0]?.days ?? 0;

        // 통계 (g5_member_board_status)
        const [statsRows] = await pool.query<StatsRow[]>(
            `SELECT total_post_count, delete_post_count,
			        total_comment_count, delete_comment_count,
			        delete_post_by_admin, delete_comment_by_admin,
			        total_rcmd_count, total_singo_count
			 FROM g5_member_board_status WHERE mb_id = ?`,
            [memberId]
        );
        const stats = statsRows[0] || {
            total_post_count: 0,
            delete_post_count: 0,
            total_comment_count: 0,
            delete_comment_count: 0,
            delete_post_by_admin: 0,
            delete_comment_by_admin: 0,
            total_rcmd_count: 0,
            total_singo_count: 0
        };

        // 이용제한 정보
        let discipline = null;
        try {
            const [discRows] = await pool.query<DisciplineRow[]>(
                `SELECT penalty_period, penalty_date_from
				 FROM g5_da_member_discipline WHERE penalty_mb_id = ?`,
                [memberId]
            );
            if (discRows.length > 0) {
                discipline = {
                    penalty_period: discRows[0].penalty_period,
                    penalty_date_from: discRows[0].penalty_date_from
                };
            }
        } catch {
            // 테이블 없으면 무시
        }

        // 팔로워/팔로잉 수
        const [followerRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
            [memberId]
        );
        const [followingRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_member_follow WHERE mb_id = ?',
            [memberId]
        );

        // 이미지 URL 처리
        let imageUrl = '';
        if (member.mb_image_url) {
            imageUrl = member.mb_image_url.startsWith('http')
                ? member.mb_image_url
                : `/data/member/${memberId}.gif`;
        }

        return json({
            success: true,
            data: {
                mb_id: member.mb_id,
                mb_name: member.mb_nick || member.mb_name,
                mb_level: member.mb_level,
                mb_point: member.mb_point,
                mb_image: imageUrl,
                mb_signature: member.mb_signature || '',
                mb_homepage: member.mb_homepage || '',
                mb_profile: member.mb_profile || '',
                mb_datetime: member.mb_datetime,
                mb_today_login: member.mb_today_login || '',
                mb_nick_date: member.mb_nick_date || '',
                mb_certify: !!member.mb_certify,
                is_left: isLeft,
                mb_leave_date: member.mb_leave_date || '',
                reg_days: regDays,
                // 경험치
                as_level: member.as_level || 0,
                as_exp: member.as_exp || 0,
                as_max: member.as_max || 1,
                // 통계
                stats: {
                    total_post_count: stats.total_post_count,
                    delete_post_count: stats.delete_post_count,
                    total_comment_count: stats.total_comment_count,
                    delete_comment_count: stats.delete_comment_count,
                    delete_post_by_admin: stats.delete_post_by_admin,
                    delete_comment_by_admin: stats.delete_comment_by_admin,
                    total_rcmd_count: stats.total_rcmd_count,
                    total_singo_count: stats.total_singo_count
                },
                // 이용제한
                discipline,
                // 팔로우
                follower_count: followerRows[0]?.count ?? 0,
                following_count: followingRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('[Member Profile API] error:', error);
        return json({ success: false, error: '프로필 조회에 실패했습니다.' }, { status: 500 });
    }
};

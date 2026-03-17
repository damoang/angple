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

// Level thresholds (cumulative exp required for each level) — synced with backend
const levelThresholds = [
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000,
    105000, 120000, 136000, 153000, 171000, 190000, 210000, 231000, 253000, 276000, 300000, 325000,
    351000, 378000, 406000, 435000, 466000, 499000, 534000, 571000, 610000, 651000, 694000, 739000,
    786000, 835000, 887000, 941000, 998000, 1058000, 1121000, 1187000, 1256000, 1328000, 1403000,
    1481000, 1563000, 1649000, 1739000, 1833000, 1931000, 2033000, 2139000, 2249000, 2363000,
    2481000, 2604000, 2732000, 2865000, 3003000, 3146000, 3294000, 3447000, 3605000, 3768000,
    3936000, 4110000, 4290000, 4476000, 4668000, 4866000, 5070000, 5280000, 5496000, 5718000,
    5946000, 6181000, 6423000, 6672000, 6928000, 7191000, 7461000, 7738000, 8022000, 8313000,
    8611000, 8917000, 9231000, 9553000, 9883000, 10221000, 10567000, 10921000, 11283000, 11653000,
    12031000, 12418000, 12814000, 13219000, 13633000, 14056000, 14488000, 14929000, 15379000,
    15838000
];

function calculateLevelInfo(totalExp: number) {
    let currentLevel = 1;
    for (let i = 0; i < levelThresholds.length; i++) {
        if (totalExp >= levelThresholds[i]) {
            currentLevel = i + 1;
        } else {
            break;
        }
    }

    if (currentLevel >= levelThresholds.length) {
        return {
            currentLevel,
            nextLevelExp: levelThresholds[levelThresholds.length - 1],
            expToNext: 0,
            progress: 100
        };
    }

    const nextLevelExp = levelThresholds[currentLevel];
    const prevLevelExp = currentLevel > 1 ? levelThresholds[currentLevel - 1] : 0;
    const expToNext = nextLevelExp - totalExp;
    const levelRange = nextLevelExp - prevLevelExp;
    const progress =
        levelRange > 0 ? Math.round(((totalExp - prevLevelExp) * 100) / levelRange) : 0;

    return { currentLevel, nextLevelExp, expToNext, progress };
}

export const GET: RequestHandler = async ({ params }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_-]+$/.test(memberId)) {
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

        // 이미지 URL: 원본 값 그대로 전달 (프론트에서 getAvatarUrl로 CDN URL 변환)
        const imageUrl = member.mb_image_url || '';

        return json({
            success: true,
            data: {
                mb_id: member.mb_id,
                mb_name: member.mb_nick || member.mb_name,
                mb_level: member.mb_level,
                mb_point: member.mb_point,
                mb_image: imageUrl,
                mb_image_updated_at: member.mb_image_updated_at || '',
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
                // 경험치 (levelThresholds 기반 계산)
                as_level: calculateLevelInfo(member.as_exp || 0).currentLevel,
                as_exp: member.as_exp || 0,
                as_max: calculateLevelInfo(member.as_exp || 0).nextLevelExp,
                exp_to_next: calculateLevelInfo(member.as_exp || 0).expToNext,
                exp_progress: calculateLevelInfo(member.as_exp || 0).progress,
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

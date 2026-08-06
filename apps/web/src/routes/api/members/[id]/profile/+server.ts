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
    mb_image_updated_at: string;
    mb_certify: string;
    mb_leave_date: string;
    mb_leave_reason: string;
    as_level: number;
    as_exp: number;
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

interface DisciplineLogRow extends RowDataPacket {
    wr_id: number;
    wr_content: string;
    wr_datetime: string;
}

import { parseDisciplineLogContent, type DisciplineEntry } from './_parse-discipline';
import { calculateMemberCounts } from './_recompute-counts';
import { calculateLevelInfo as calcLevelInfo } from '$lib/utils/level-thresholds';

interface CountRow extends RowDataPacket {
    count: number;
    days: number;
}

interface NickHistoryRow extends RowDataPacket {
    old_nick: string;
    new_nick: string;
    changed_at: string;
}

/**
 * 레벨 계산은 정본($lib/utils/level-thresholds)에 위임한다.
 *
 * ⛔ 여기에 임계값 표를 다시 만들지 말 것. 원래 109개짜리 사본이 있었는데,
 *    그 사본이 백엔드와 다른 곡선이라 같은 회원이 이 API 로는 Lv.34,
 *    백엔드 /my 로는 Lv.25 로 보였다(bug/13149, 2026-07-29).
 *    정본은 backend internal/repository/v2/exp_repo.go 의 levelExp 다.
 *
 * 반환 필드명(currentLevel)은 기존 호출부 호환을 위해 유지한다.
 */
function calculateLevelInfo(totalExp: number) {
    const info = calcLevelInfo(totalExp);
    return {
        currentLevel: info.level,
        nextLevelExp: info.nextLevelExp,
        expToNext: info.expToNext,
        progress: info.progress
    };
}

export const GET: RequestHandler = async ({ params, locals }) => {
    // #12501: 비로그인 사용자의 타 회원 프로필 열람 차단 (개인정보 보호)
    if (!locals.user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const memberId = params.id;

    // mb_id (영문/숫자/_-) 또는 mb_nick (한글 포함) 둘 다 허용 (#12371).
    // 멘션 링크 (@닉네임) 가 한글 닉네임으로 /member/{닉네임} 형태로 들어오므로 차단하지 않음.
    // 경로 traversal/주입 방지 위해 길이 제한 + 위험 문자만 차단.
    const isValidMemberId =
        !!memberId &&
        memberId.length > 0 &&
        memberId.length <= 50 &&
        !/[\\\/?#<>%\s\0]/.test(memberId);
    if (!isValidMemberId) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    try {
        // mb_id / mb_nick 둘 다 허용하되, 슬러그가 한 계정의 mb_id이자 다른 계정의 닉네임일 때
        // (소셜로그인 닉 충돌 등) mb_id 정확 일치를 우선시킨다. 우선순위가 없으면 rows[0]이
        // 비결정적으로 닉 매칭 계정을 반환해 엉뚱한 프로필이 노출됨.
        const [rows] = await pool.query<MemberRow[]>(
            `SELECT mb_id, mb_name, mb_nick, mb_level, mb_point,
                    mb_signature, mb_homepage, mb_profile,
                    mb_datetime, mb_today_login, mb_nick_date,
                    mb_image_url, mb_image_updated_at, mb_certify, mb_leave_date, mb_leave_reason,
                    as_level, as_exp
             FROM g5_member
             WHERE mb_id = ? OR mb_nick = ?
             ORDER BY (mb_id = ?) DESC
             LIMIT 1`,
            [memberId, memberId, memberId]
        );

        if (rows.length === 0) {
            return json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
        }

        const member = rows[0];
        const isLeft = !!member.mb_leave_date;

        // 탈퇴 회원: 신원·활동·통계·이용제한·공감·팔로워 전부 비노출.
        // 조회불가 최소응답만 반환(로그인 회원에게도 미노출). 개인정보 분쟁조정 대응.
        if (isLeft) {
            return json({
                success: true,
                data: {
                    mb_id: member.mb_id, // URL에 이미 있는 값 — 추가 노출 아님
                    is_left: true,
                    withdrawn: true
                }
            });
        }

        // 가입 후 경과일
        const [daysRows] = await pool.query<CountRow[]>(`SELECT DATEDIFF(NOW(), ?) + 1 AS days`, [
            member.mb_datetime
        ]);
        const regDays = daysRows[0]?.days ?? 0;

        // 통계 (g5_member_board_status)
        const defaultStats = {
            total_post_count: 0,
            delete_post_count: 0,
            total_comment_count: 0,
            delete_comment_count: 0,
            delete_post_by_admin: 0,
            delete_comment_by_admin: 0,
            total_rcmd_count: 0,
            total_singo_count: 0
        };
        let stats = defaultStats;
        try {
            const [statsRows] = await pool.query<StatsRow[]>(
                `SELECT total_post_count, delete_post_count,
                        total_comment_count, delete_comment_count,
                        delete_post_by_admin, delete_comment_by_admin,
                        total_rcmd_count, total_singo_count
                 FROM g5_member_board_status WHERE mb_id = ?`,
                [memberId]
            );
            stats = statsRows[0] || defaultStats;
        } catch {
            // 테이블 없으면 기본값 사용
        }

        // 글·댓글 통계 실시간 재계산 (#12113 → bug/13341)
        //
        // ⛔ 총계와 삭제 수를 **같은 쿼리**에서 함께 센다. 예전에는 총계만 stale 값
        //    (g5_member_board_status)을 쓰고 삭제 수만 실시간이라, 화면의 "생존 =
        //    총계 - 삭제" 가 서로 다른 시점·모집단의 뺄셈이 되어 실제와 크게 어긋났다
        //    (실측: 표시 생존 58 vs 실제 2). 댓글은 재계산조차 없어 전부 stale 이었다.
        try {
            const counts = await calculateMemberCounts(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (sql: string, params?: unknown[]) => pool.query(sql, params) as any,
                memberId
            );
            if (counts) {
                stats = {
                    ...stats,
                    total_post_count: counts.totalPosts,
                    delete_post_count: counts.deletedPosts,
                    total_comment_count: counts.totalComments,
                    delete_comment_count: counts.deletedComments
                };
            }
            // counts === null 이면 재계산 실패 — stale 값을 그대로 두되 뺄셈이
            // 어긋나 있을 수 있음을 감안한다(표시 자체는 기존과 동일).
        } catch (err) {
            console.error('[Member Profile API] member counts recompute failed:', err);
        }

        // 이용제한 내역 (옵션 A: g5_write_disciplinelog 단일 출처)
        // - wr_subject 매칭은 PHP `mb_id(닉네임)` / Go `mb_id` 두 형식 모두 처리
        // - wr_content (JSON) 파싱 → penalty_period / penalty_date_from / sg_types 추출
        // - 파싱 실패 row 는 skip
        // 분석 보고서: /home/angple/docs/2026-04-28-discipline-data-flow-analysis.md (옵션 A)
        let discipline: DisciplineEntry | null = null;
        let disciplineHistory: DisciplineEntry[] = [];
        try {
            const [logRows] = await pool.query<DisciplineLogRow[]>(
                `SELECT wr_id, wr_content, wr_datetime FROM g5_write_disciplinelog
                 WHERE (wr_subject = ? OR wr_subject LIKE CONCAT(?, '(%'))
                   AND wr_is_comment = 0
                 ORDER BY wr_datetime DESC LIMIT 10`,
                [memberId, memberId]
            );
            for (const row of logRows) {
                const entry = parseDisciplineLogContent(row);
                // 소명 인용 등으로 회수(revoke)된 제재는 프로필 이력에서 제외 —
                // 처분이 취소된 건을 유효한 제재처럼 노출하지 않는다.
                // 전체 기록(회수 표시 포함)은 /disciplinelog 에서 확인 가능.
                if (entry && !entry.revoked) {
                    disciplineHistory.push(entry);
                }
            }
            if (disciplineHistory.length > 0) {
                discipline = disciplineHistory[0];
            }
        } catch {
            // 테이블 없으면 무시 (e.g. 신규 환경)
            discipline = null;
            disciplineHistory = [];
        }

        // 팔로워/팔로잉 수
        let followerRows: CountRow[] = [];
        let followingRows: CountRow[] = [];
        try {
            [followerRows] = await pool.query<CountRow[]>(
                'SELECT COUNT(*) AS count FROM g5_member_follow WHERE target_id = ?',
                [memberId]
            );
            [followingRows] = await pool.query<CountRow[]>(
                'SELECT COUNT(*) AS count FROM g5_member_follow WHERE mb_id = ?',
                [memberId]
            );
        } catch {
            // 테이블 없으면 무시
        }

        // 닉네임 변경 이력 (공개, 최근순 — #13026). g5_member_nick_history 에 적재됨.
        // member.mb_id(정본) 기준 — 슬러그가 닉일 수 있어 memberId(슬러그) 대신 사용.
        let nickHistory: NickHistoryRow[] = [];
        try {
            [nickHistory] = await pool.query<NickHistoryRow[]>(
                `SELECT old_nick, new_nick, changed_at FROM g5_member_nick_history
                 WHERE mb_id = ? ORDER BY changed_at DESC LIMIT 30`,
                [member.mb_id]
            );
        } catch {
            // 테이블 없으면 무시
        }

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
                mb_leave_reason: member.mb_leave_reason || '',
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
                discipline_history: disciplineHistory,
                // 팔로우
                follower_count: followerRows[0]?.count ?? 0,
                following_count: followingRows[0]?.count ?? 0,
                // 닉네임 변경 이력 (전체 공개, 최근순) — #13026.
                // old→new 전 체인을 모든 회원에게 동일하게 전송한다. 권한별 차등 응답을 두지
                // 않는다: 클라이언트 {#if}로 숨기는 방식은 토큰 위조·스토어 조작 시 노출되므로,
                // 공개 정책이면 서버가 애초에 누구에게나 같은 데이터를 보낸다(펼치기로 노출).
                nick_history: nickHistory.map((h) => ({
                    old_nick: h.old_nick,
                    new_nick: h.new_nick,
                    changed_at: h.changed_at
                }))
            }
        });
    } catch (error) {
        console.error('[Member Profile API] error:', error);
        return json({ success: false, error: '프로필 조회에 실패했습니다.' }, { status: 500 });
    }
};

/**
 * 회원 상호작용 분석 API
 * GET /api/members/[id]/interactions
 *
 * 특정 회원에게 공감/댓글을 가장 많이 남긴 상위 N명을 기간별로 조회.
 * 여론 조작/집단 활동 패턴 탐지 목적.
 *
 * 쿼리 파라미터:
 * - period: 'day' | 'week' | 'month' | 'year' | 'all' (기본: month)
 * - type: 'like' | 'comment' | 'all' (기본: all)
 * - direction: 'given' | 'received' (기본: received)
 *   - received: 이 회원의 글에 공감/댓글을 남긴 사람 상위
 *   - given: 이 회원이 공감/댓글을 남긴 대상 상위
 * - limit: 상위 몇 명 (기본: 10, 최대: 20)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

interface InteractionRow extends RowDataPacket {
    mb_id: string;
    mb_name: string;
    like_count: number;
    comment_count: number;
    total_count: number;
}

interface TotalRow extends RowDataPacket {
    total: number;
}

/** 주요 게시판 목록 (댓글 분석용) */
const MAJOR_BOARDS = [
    'free',
    'economy',
    'qa',
    'notice',
    'gallery',
    'humor',
    'tip',
    'review',
    'angtt',
    'giving',
    'news',
    'politics',
    'game',
    'travel',
    'food',
    'car',
    'digital',
    'life'
];

export const GET: RequestHandler = async ({ params, url, cookies }) => {
    const targetId = params.id;
    if (!targetId) {
        return json({ success: false, error: '회원 ID가 필요합니다.' }, { status: 400 });
    }

    // 인증 확인
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 권한 확인: 관리자(레벨 10+) 또는 본인만 허용
    // TODO: 플러그인 설정의 visibility에 따라 동적 제어
    const isAdmin = user.mb_level >= 10;
    const isSelf = user.mb_id === targetId;
    if (!isAdmin && !isSelf) {
        return json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const period = (url.searchParams.get('period') || 'month') as string;
    const type = (url.searchParams.get('type') || 'all') as string;
    const direction = (url.searchParams.get('direction') || 'received') as string;
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '10')), 20);

    // 기간 조건
    let dateCondition = '';
    const periodLabels: Record<string, string> = {
        day: '오늘',
        week: '이번 주',
        month: '이번 달',
        year: '올해',
        all: '전체'
    };

    switch (period) {
        case 'day':
            dateCondition = 'AND bg_datetime >= CURDATE()';
            break;
        case 'week':
            dateCondition = 'AND bg_datetime >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
            break;
        case 'month':
            dateCondition = 'AND bg_datetime >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
            break;
        case 'year':
            dateCondition = 'AND bg_datetime >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
            break;
        default:
            dateCondition = '';
    }

    try {
        const entries: InteractionRow[] = [];

        if (direction === 'received') {
            // 이 회원의 글에 공감/댓글을 남긴 사람 상위
            await queryReceivedInteractions(targetId, type, dateCondition, limit, entries);
        } else {
            // 이 회원이 공감/댓글을 남긴 대상 상위
            await queryGivenInteractions(targetId, type, dateCondition, limit, entries);
        }

        // 전체 상호작용 수
        let totalInteractions = 0;
        for (const e of entries) {
            totalInteractions += e.total_count;
        }

        return json({
            success: true,
            data: {
                target_mb_id: targetId,
                direction,
                period,
                period_label: periodLabels[period] || period,
                interaction_type: type,
                entries,
                total_interactions: totalInteractions,
                analyzed_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Interaction analysis API error:', error);
        return json(
            { success: false, error: '분석 데이터를 가져오는데 실패했습니다.' },
            { status: 500 }
        );
    }
};

/**
 * 이 회원의 글에 공감/댓글을 남긴 사람 상위 N명
 * "누가 나에게 가장 많이 반응했는가"
 */
async function queryReceivedInteractions(
    targetId: string,
    type: string,
    dateCondition: string,
    limit: number,
    entries: InteractionRow[]
) {
    // 공감 분석: g5_board_good에서 target의 글에 추천한 사람
    let likeMap = new Map<string, { count: number; name: string }>();
    if (type === 'like' || type === 'all') {
        const likeDateCond = dateCondition.replace(/bg_datetime/g, 'g.bg_datetime');
        const unionParts = MAJOR_BOARDS.map(
            () => `SELECT wr_id FROM ?? WHERE mb_id = ? AND wr_is_comment = 0`
        ).join(' UNION ALL ');
        const unionParams = MAJOR_BOARDS.flatMap((b) => [`g5_write_${b}`, targetId]);

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT g.mb_id, m.mb_nick as mb_name, COUNT(*) as cnt
			 FROM g5_board_good g
			 JOIN g5_member m ON g.mb_id = m.mb_id
			 WHERE g.bg_flag = 'good'
			   AND g.wr_id IN (${unionParts})
			   AND g.mb_id != ?
			   ${likeDateCond}
			 GROUP BY g.mb_id, m.mb_nick
			 ORDER BY cnt DESC
			 LIMIT ?`,
            [...unionParams, targetId, limit * 2]
        );

        for (const row of rows) {
            likeMap.set(row.mb_id, { count: row.cnt, name: row.mb_name });
        }
    }

    // 댓글 분석: 주요 게시판에서 target의 글에 댓글 단 사람
    let commentMap = new Map<string, { count: number; name: string }>();
    if (type === 'comment' || type === 'all') {
        const commentDateCond = dateCondition.replace(/bg_datetime/g, 'c.wr_datetime');
        for (const board of MAJOR_BOARDS) {
            const table = `g5_write_${board}`;
            try {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT c.mb_id, m.mb_nick as mb_name, COUNT(*) as cnt
					 FROM ?? c
					 JOIN g5_member m ON c.mb_id = m.mb_id
					 WHERE c.wr_is_comment = 1
					   AND c.wr_parent IN (
					     SELECT wr_id FROM ?? WHERE mb_id = ? AND wr_is_comment = 0
					   )
					   AND c.mb_id != ?
					   AND c.mb_id != ''
					   ${commentDateCond}
					 GROUP BY c.mb_id, m.mb_nick`,
                    [table, table, targetId, targetId]
                );

                for (const row of rows) {
                    const existing = commentMap.get(row.mb_id);
                    if (existing) {
                        existing.count += row.cnt;
                    } else {
                        commentMap.set(row.mb_id, { count: row.cnt, name: row.mb_name });
                    }
                }
            } catch {
                // 테이블이 없으면 스킵
            }
        }
    }

    // 병합
    mergeResults(likeMap, commentMap, type, limit, entries);
}

/**
 * 이 회원이 공감/댓글을 남긴 대상 상위 N명
 * "내가 누구에게 가장 많이 반응했는가"
 */
async function queryGivenInteractions(
    targetId: string,
    type: string,
    dateCondition: string,
    limit: number,
    entries: InteractionRow[]
) {
    // 공감 분석: target이 추천한 글의 작성자
    let likeMap = new Map<string, { count: number; name: string }>();
    if (type === 'like' || type === 'all') {
        const likeDateCond = dateCondition.replace(/bg_datetime/g, 'g.bg_datetime');
        for (const board of MAJOR_BOARDS) {
            const table = `g5_write_${board}`;
            try {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT w.mb_id, m.mb_nick as mb_name, COUNT(*) as cnt
					 FROM g5_board_good g
					 JOIN ?? w ON g.wr_id = w.wr_id AND w.wr_is_comment = 0
					 JOIN g5_member m ON w.mb_id = m.mb_id
					 WHERE g.mb_id = ?
					   AND g.bo_table = ?
					   AND g.bg_flag = 'good'
					   AND w.mb_id != ?
					   ${likeDateCond}
					 GROUP BY w.mb_id, m.mb_nick`,
                    [table, targetId, board, targetId]
                );

                for (const row of rows) {
                    const existing = likeMap.get(row.mb_id);
                    if (existing) {
                        existing.count += row.cnt;
                    } else {
                        likeMap.set(row.mb_id, { count: row.cnt, name: row.mb_name });
                    }
                }
            } catch {
                // 테이블이 없으면 스킵
            }
        }
    }

    // 댓글 분석: target이 댓글 단 글의 작성자
    let commentMap = new Map<string, { count: number; name: string }>();
    if (type === 'comment' || type === 'all') {
        const commentDateCond = dateCondition.replace(/bg_datetime/g, 'c.wr_datetime');
        for (const board of MAJOR_BOARDS) {
            const table = `g5_write_${board}`;
            try {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT p.mb_id, m.mb_nick as mb_name, COUNT(*) as cnt
					 FROM ?? c
					 JOIN ?? p ON c.wr_parent = p.wr_id AND p.wr_is_comment = 0
					 JOIN g5_member m ON p.mb_id = m.mb_id
					 WHERE c.mb_id = ?
					   AND c.wr_is_comment = 1
					   AND p.mb_id != ?
					   AND p.mb_id != ''
					   ${commentDateCond}
					 GROUP BY p.mb_id, m.mb_nick`,
                    [table, table, targetId, targetId]
                );

                for (const row of rows) {
                    const existing = commentMap.get(row.mb_id);
                    if (existing) {
                        existing.count += row.cnt;
                    } else {
                        commentMap.set(row.mb_id, { count: row.cnt, name: row.mb_name });
                    }
                }
            } catch {
                // 테이블이 없으면 스킵
            }
        }
    }

    // 병합
    mergeResults(likeMap, commentMap, type, limit, entries);
}

/**
 * 공감/댓글 맵을 병합하여 상위 N명 반환
 */
function mergeResults(
    likeMap: Map<string, { count: number; name: string }>,
    commentMap: Map<string, { count: number; name: string }>,
    type: string,
    limit: number,
    entries: InteractionRow[]
) {
    const merged = new Map<string, InteractionRow>();

    // 공감 데이터 병합
    for (const [mbId, data] of likeMap) {
        merged.set(mbId, {
            mb_id: mbId,
            mb_name: data.name,
            like_count: data.count,
            comment_count: 0,
            total_count: data.count
        } as InteractionRow);
    }

    // 댓글 데이터 병합
    for (const [mbId, data] of commentMap) {
        const existing = merged.get(mbId);
        if (existing) {
            existing.comment_count = data.count;
            existing.total_count = existing.like_count + data.count;
        } else {
            merged.set(mbId, {
                mb_id: mbId,
                mb_name: data.name,
                like_count: 0,
                comment_count: data.count,
                total_count: data.count
            } as InteractionRow);
        }
    }

    // 정렬 + 상위 N명
    const sorted = Array.from(merged.values())
        .sort((a, b) => b.total_count - a.total_count)
        .slice(0, limit);

    entries.push(...sorted);
}

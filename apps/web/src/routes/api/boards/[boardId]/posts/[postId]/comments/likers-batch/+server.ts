/**
 * 댓글 추천자 배치 조회 API
 * GET /api/boards/[boardId]/posts/[postId]/comments/likers-batch?commentIds=1,2,3&limit=5
 *
 * 여러 댓글의 추천자를 한 번에 조회 (N+1 방지)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

function maskIp(ip: string | null | undefined): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        parts[1] = '♡';
        return parts.join('.');
    }
    return ip.slice(0, 3) + '.♡';
}

interface LikerRow extends RowDataPacket {
    wr_id: number;
    mb_id: string;
    mb_nick: string;
    mb_name: string;
    mb_image_url: string;
    bg_ip: string;
    bg_datetime: string;
}

interface CountRow extends RowDataPacket {
    wr_id: number;
    total: number;
}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
    const { boardId } = params;
    const commentIdsParam = url.searchParams.get('commentIds');
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10)));

    if (!boardId || !commentIdsParam) {
        return json(
            { success: false, message: 'boardId와 commentIds가 필요합니다.' },
            { status: 400 }
        );
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');

    // commentIds 파싱 및 검증 (최대 20개)
    const commentIds = commentIdsParam
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id))
        .slice(0, 20);

    if (commentIds.length === 0) {
        return json({ success: false, message: '유효한 commentIds가 없습니다.' }, { status: 400 });
    }

    try {
        const user = await getAuthUser(cookies);
        const isAuthenticated = !!user;

        const placeholders = commentIds.map(() => '?').join(',');

        // 댓글별 추천자 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT wr_id, COUNT(*) AS total FROM g5_board_good
			 WHERE bo_table = ? AND wr_id IN (${placeholders}) AND bg_flag = 'good'
			 GROUP BY wr_id`,
            [safeBoardId, ...commentIds]
        );

        const totalMap = new Map<number, number>();
        for (const row of countRows) {
            totalMap.set(row.wr_id, row.total);
        }

        // 댓글별 추천자 목록 (limit개씩, 최신순)
        // ROW_NUMBER() 윈도우 함수로 댓글별 limit 적용
        const [likerRows] = await pool.query<LikerRow[]>(
            `SELECT sub.wr_id, sub.mb_id, sub.mb_nick, sub.mb_name, sub.mb_image_url, sub.bg_ip, sub.bg_datetime
			 FROM (
			   SELECT g.wr_id, g.mb_id, m.mb_nick, m.mb_name, COALESCE(m.mb_image_url, '') as mb_image_url, g.bg_ip, g.bg_datetime,
			          ROW_NUMBER() OVER (PARTITION BY g.wr_id ORDER BY g.bg_datetime DESC) AS rn
			   FROM g5_board_good g
			   JOIN g5_member m ON g.mb_id = m.mb_id
			   WHERE g.bo_table = ? AND g.wr_id IN (${placeholders}) AND g.bg_flag = 'good'
			 ) sub
			 WHERE sub.rn <= ?`,
            [safeBoardId, ...commentIds, limit]
        );

        // 결과를 commentId별로 그룹핑
        const data: Record<
            string,
            {
                likers: Array<{
                    mb_id: string;
                    mb_name: string;
                    mb_nick: string;
                    bg_ip: string;
                    liked_at: string;
                }>;
                total: number;
            }
        > = {};

        for (const id of commentIds) {
            data[String(id)] = {
                likers: [],
                total: totalMap.get(id) ?? 0
            };
        }

        for (const row of likerRows) {
            const key = String(row.wr_id);
            if (data[key]) {
                data[key].likers.push({
                    mb_id: row.mb_id,
                    mb_name: row.mb_name,
                    mb_nick: row.mb_nick,
                    mb_image: row.mb_image_url || '',
                    bg_ip: isAuthenticated ? maskIp(row.bg_ip) : '',
                    liked_at: String(row.bg_datetime).replace(' ', 'T') + 'Z'
                });
            }
        }

        return json({ success: true, data });
    } catch (error) {
        console.error('Comment likers batch GET error:', error);
        return json(
            { success: false, message: '추천자 목록 배치 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

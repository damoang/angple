/**
 * 댓글 목록 API (레거시 g5_write_{boardId} 기반)
 *
 * GET /api/boards/[boardId]/posts/[postId]/comments?page=1&limit=10
 *
 * wr_comment + wr_comment_reply 순서로 정렬하여 올바른 스레드 순서 보장
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface CommentRow extends RowDataPacket {
    wr_id: number;
    wr_parent: number;
    wr_comment: number;
    wr_comment_reply: string;
    wr_content: string;
    wr_option: string;
    wr_good: number;
    wr_nogood: number;
    mb_id: string;
    wr_name: string;
    wr_ip: string;
    wr_datetime: string;
}

interface CountRow extends RowDataPacket {
    total: number;
}

function maskIp(ip: string): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.♡.${parts[2]}.${parts[3]}`;
    }
    return ip;
}

export const GET: RequestHandler = async ({ params, url }) => {
    const { boardId, postId } = params;

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(postId, 10);

    if (isNaN(safePostId)) {
        return json({ success: false, message: '유효하지 않은 postId입니다.' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));

    const tableName = `g5_write_${safeBoardId}`;

    try {
        // 전체 댓글 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM ?? WHERE wr_parent = ? AND wr_is_comment = 1`,
            [tableName, safePostId]
        );
        const total = countRows[0]?.total ?? 0;
        const totalPages = Math.ceil(total / limit);

        // wr_comment 기준 페이징: 루트 댓글의 wr_comment 값으로 페이징
        // 먼저 해당 페이지의 wr_comment 범위 구하기
        const [rootComments] = await pool.query<RowDataPacket[]>(
            `SELECT DISTINCT wr_comment FROM ?? WHERE wr_parent = ? AND wr_is_comment = 1
			 ORDER BY wr_comment
			 LIMIT ? OFFSET ?`,
            [tableName, safePostId, limit, (page - 1) * limit]
        );

        if (rootComments.length === 0) {
            return json({
                success: true,
                data: {
                    comments: [],
                    total,
                    page,
                    limit,
                    total_pages: totalPages
                }
            });
        }

        const commentNums = rootComments.map((r) => r.wr_comment);
        const minComment = commentNums[0];
        const maxComment = commentNums[commentNums.length - 1];

        // 해당 wr_comment 범위의 모든 댓글 (루트 + 대댓글) 가져오기
        const [rows] = await pool.query<CommentRow[]>(
            `SELECT wr_id, wr_parent, wr_comment, wr_comment_reply, wr_content, wr_option,
			        wr_good, wr_nogood, mb_id, wr_name, wr_ip, wr_datetime
			 FROM ??
			 WHERE wr_parent = ? AND wr_is_comment = 1
			   AND wr_comment >= ? AND wr_comment <= ?
			 ORDER BY wr_comment, wr_comment_reply`,
            [tableName, safePostId, minComment, maxComment]
        );

        // 닉네임 조회 (mb_id → mb_nick)
        const mbIds = [...new Set(rows.map((r) => r.mb_id).filter(Boolean))];
        const nickMap = new Map<string, string>();
        if (mbIds.length > 0) {
            const [members] = await pool.query<RowDataPacket[]>(
                `SELECT mb_id, mb_nick FROM g5_member WHERE mb_id IN (?)`,
                [mbIds]
            );
            for (const m of members) {
                nickMap.set(m.mb_id, m.mb_nick);
            }
        }

        const comments = rows.map((row) => ({
            id: row.wr_id,
            content: row.wr_content,
            author: nickMap.get(row.mb_id) || row.wr_name || row.mb_id,
            author_id: row.mb_id,
            author_ip: maskIp(row.wr_ip),
            likes: row.wr_good,
            dislikes: row.wr_nogood,
            depth: row.wr_comment_reply.length,
            parent_id: row.wr_parent,
            created_at: row.wr_datetime,
            is_secret: row.wr_option?.includes('secret') || false
        }));

        return json({
            success: true,
            data: {
                comments,
                total,
                page,
                limit,
                total_pages: totalPages
            }
        });
    } catch (error) {
        console.error('Comments GET error:', error);
        return json({ success: false, message: '댓글 조회에 실패했습니다.' }, { status: 500 });
    }
};

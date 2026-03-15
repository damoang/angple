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
    wr_deleted_at: string | null;
    wr_deleted_by: string | null;
    wr_7: string | null;
}

interface CountRow extends RowDataPacket {
    total: number;
}

interface EditCountRow extends RowDataPacket {
    wr_id: number;
    cnt: number;
}

function maskIp(ip: string): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.♡.${parts[2]}.${parts[3]}`;
    }
    return ip;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
    const { boardId, postId } = params;
    const isAdmin = (locals.user?.level ?? 0) >= 10;

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(postId, 10);

    if (isNaN(safePostId)) {
        return json({ success: false, message: '유효하지 않은 postId입니다.' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10)));

    const tableName = `g5_write_${safeBoardId}`;

    // 차단 회원 목록 조회
    let blockedMbIds: string[] = [];
    if (locals.user?.id) {
        try {
            const [blockRows] = await pool.query<RowDataPacket[]>(
                `SELECT blocked_mb_id FROM g5_member_block WHERE mb_id = ?`,
                [locals.user.id]
            );
            blockedMbIds = blockRows.map((r) => r.blocked_mb_id);
        } catch {
            // 차단 테이블 없어도 계속 진행
        }
    }

    try {
        // 차단 필터 조건
        const blockFilter =
            blockedMbIds.length > 0
                ? ` AND mb_id NOT IN (${blockedMbIds.map(() => '?').join(',')})`
                : '';
        const blockParams = blockedMbIds.length > 0 ? blockedMbIds : [];

        // 전체 댓글 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM ?? WHERE wr_parent = ? AND wr_is_comment = 1${blockFilter}`,
            [tableName, safePostId, ...blockParams]
        );
        const total = countRows[0]?.total ?? 0;
        const totalPages = Math.ceil(total / limit);

        // 댓글 조회 (wr_comment + wr_comment_reply 순으로 정렬 — Go 백엔드와 동일)
        // 삭제된 댓글도 포함하여 조회 (프론트엔드에서 "삭제된 댓글입니다" 표시용)
        const [rows] = await pool.query<CommentRow[]>(
            `SELECT wr_id, wr_parent, wr_comment, wr_comment_reply, wr_content, wr_option,
			        wr_good, wr_nogood, mb_id, wr_name, wr_ip, wr_datetime,
			        wr_deleted_at, wr_deleted_by, wr_7
			 FROM ??
			 WHERE wr_parent = ? AND wr_is_comment = 1${blockFilter}
			 ORDER BY wr_comment, wr_comment_reply
			 LIMIT ? OFFSET ?`,
            [tableName, safePostId, ...blockParams, limit, (page - 1) * limit]
        );

        // 닉네임 조회 (mb_id → mb_nick)
        const mbIds = [...new Set(rows.map((r) => r.mb_id).filter(Boolean))];
        const nickMap = new Map<string, string>();
        const imageMap = new Map<string, string>();
        if (mbIds.length > 0) {
            const [members] = await pool.query<RowDataPacket[]>(
                `SELECT mb_id, mb_nick, mb_image_url FROM g5_member WHERE mb_id IN (?)`,
                [mbIds]
            );
            for (const m of members) {
                nickMap.set(m.mb_id, m.mb_nick);
                if (m.mb_image_url) imageMap.set(m.mb_id, m.mb_image_url);
            }
        }

        // 댓글별 수정 횟수 배치 조회 (g5_write_revisions)
        const commentIds = rows.map((r) => r.wr_id);
        const editCountMap = new Map<number, number>();
        if (commentIds.length > 0) {
            const [editCounts] = await pool.query<EditCountRow[]>(
                `SELECT wr_id, COUNT(*) AS cnt FROM g5_write_revisions WHERE board_id = ? AND wr_id IN (?) GROUP BY wr_id`,
                [safeBoardId, commentIds]
            );
            for (const ec of editCounts) {
                editCountMap.set(ec.wr_id, ec.cnt);
            }
        }

        const comments = rows.map((row) => ({
            id: row.wr_id,
            content: row.wr_deleted_at ? (isAdmin ? row.wr_content : '') : row.wr_content,
            author: row.wr_deleted_at
                ? isAdmin
                    ? nickMap.get(row.mb_id) || row.wr_name || row.mb_id
                    : ''
                : nickMap.get(row.mb_id) || row.wr_name || row.mb_id,
            author_id: row.wr_deleted_at ? (isAdmin ? row.mb_id : '') : row.mb_id,
            author_image: row.wr_deleted_at
                ? isAdmin
                    ? imageMap.get(row.mb_id) || ''
                    : ''
                : imageMap.get(row.mb_id) || '',
            author_ip: row.wr_deleted_at
                ? isAdmin
                    ? row.wr_ip
                    : ''
                : isAdmin
                  ? row.wr_ip
                  : maskIp(row.wr_ip),
            likes: row.wr_good,
            dislikes: row.wr_nogood,
            depth: row.wr_comment_reply.length,
            parent_id: row.wr_parent,
            created_at: row.wr_datetime,
            is_secret: row.wr_option?.includes('secret') || false,
            deleted_at: row.wr_deleted_at || null,
            deleted_by: row.wr_deleted_by || null,
            edit_count: editCountMap.get(row.wr_id) || 0,
            ...(isAdmin && row.wr_7
                ? {
                      report_count:
                          row.wr_7 === 'lock' ? 'lock' : parseInt(row.wr_7, 10) || undefined
                  }
                : {})
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

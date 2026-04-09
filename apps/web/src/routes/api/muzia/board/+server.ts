import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/muzia/board?id=qna&page=1&per_page=20 — 게시글 목록 (썸네일 포함) */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const boardId = url.searchParams.get('id');
        if (!boardId) return json({ success: false, error: 'board id 필요' }, { status: 400 });

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const perPage = Math.min(50, parseInt(url.searchParams.get('per_page') || '20'));
        const offset = (page - 1) * perPage;

        const tableName = `g5_write_${boardId}`;

        // 총 개수
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM \`${tableName}\` WHERE wr_is_comment = 0`
        ) as any;
        const total = countResult[0].total;

        // 게시글 목록
        const [posts] = await pool.query(
            `SELECT wr_id as id, wr_subject as title, wr_name as author, mb_id as author_id,
                    wr_datetime as created_at, wr_hit as views, wr_good as likes,
                    wr_comment as comments_count, wr_ip as ip,
                    LEFT(wr_content, 200) as excerpt,
                    CASE WHEN wr_content LIKE '%youtu%' THEN 1 ELSE 0 END as has_youtube,
                    wr_file as has_file
             FROM \`${tableName}\`
             WHERE wr_is_comment = 0
             ORDER BY wr_num, wr_reply
             LIMIT ? OFFSET ?`,
            [perPage, offset]
        );

        // 첨부 이미지 (썸네일용)
        const postIds = (posts as any[]).map((p: any) => p.id);
        let thumbnails: Record<number, string> = {};
        if (postIds.length > 0) {
            const [files] = await pool.query(
                `SELECT bf_no, bo_table, wr_id, bf_file, bf_source, bf_type
                 FROM g5_board_file
                 WHERE bo_table = ? AND wr_id IN (?)
                   AND (bf_file LIKE '%.jpg' OR bf_file LIKE '%.jpeg' OR bf_file LIKE '%.png' OR bf_file LIKE '%.gif' OR bf_file LIKE '%.webp')
                 ORDER BY bf_no ASC`,
                [boardId, postIds]
            ) as any;
            for (const f of files) {
                if (!thumbnails[f.wr_id]) {
                    thumbnails[f.wr_id] = `https://muzia.net/data/file/${boardId}/${f.bf_file}`;
                }
            }
        }

        const result = (posts as any[]).map((p: any) => ({
            ...p,
            thumbnail: thumbnails[p.id] || null
        }));

        return json({
            success: true,
            data: { posts: result, total, page, per_page: perPage }
        });
    } catch (error) {
        console.error('[Muzia Board] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

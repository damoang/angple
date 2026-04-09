import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/muzia/recent?type=posts|comments&limit=5 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const type = url.searchParams.get('type') || 'posts';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);
        const boards = ['qna', 'forum', 'music', 'sibelius', 'tip', 'notice', 'hello', 'violin', 'piano'];

        if (type === 'comments') {
            const allComments: any[] = [];
            for (const board of boards) {
                try {
                    const [rows] = await pool.query(
                        'SELECT wr_id as id, wr_parent as parent_id, wr_name as author, LEFT(wr_content, 80) as content, wr_datetime as created_at, ? as board_id FROM g5_write_' + board + ' WHERE wr_is_comment > 0 ORDER BY wr_id DESC LIMIT 3',
                        [board]
                    ) as any;
                    allComments.push(...rows);
                } catch { /* ignore */ }
            }
            allComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return json({ success: true, data: allComments.slice(0, limit) });
        }

        // 최근글
        const allPosts: any[] = [];
        for (const board of boards) {
            try {
                const [rows] = await pool.query(
                    'SELECT wr_id as id, wr_subject as title, wr_name as author, wr_datetime as created_at, wr_comment as comments_count, ? as board_id FROM g5_write_' + board + ' WHERE wr_is_comment = 0 ORDER BY wr_id DESC LIMIT 3',
                    [board]
                ) as any;
                allPosts.push(...rows);
            } catch { /* ignore */ }
        }
        allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return json({ success: true, data: allPosts.slice(0, limit) });
    } catch (error) {
        console.error('[Muzia Recent] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

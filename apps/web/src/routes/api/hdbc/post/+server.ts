import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import mysql from 'mysql2/promise';

let hdbcPool: mysql.Pool | null = null;
function getHdbcPool() {
    if (!hdbcPool) {
        hdbcPool = mysql.createPool({
            host: 'mysql', port: 3306, user: 'hdbc', password: 'tjseh1004*',
            database: 'hdbc', connectionLimit: 3, charset: 'utf8mb4'
        });
    }
    return hdbcPool;
}

/** GET /api/hdbc/post?board=youtube&id=107 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getHdbcPool();
        const board = url.searchParams.get('board')?.replace(/[^a-z0-9_]/g, '');
        const postId = url.searchParams.get('id');
        if (!board || !postId) return json({ success: false, error: 'board, id 필요' }, { status: 400 });

        const tableName = 'g5_write_' + board;

        const [posts] = await pool.query(
            'SELECT wr_id as id, wr_subject as title, wr_content as content, wr_name as author, wr_datetime as datetime, wr_hit as views, wr_good as likes, wr_link1 as link1, wr_link2 as link2 FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment = 0',
            [postId]
        ) as any;

        if (posts.length === 0) return json({ success: false, error: '게시글 없음' }, { status: 404 });

        // 조회수 증가
        await pool.query('UPDATE `' + tableName + '` SET wr_hit = wr_hit + 1 WHERE wr_id = ?', [postId]);

        // 댓글
        const [comments] = await pool.query(
            'SELECT wr_id as id, wr_content as content, wr_name as author, wr_datetime as datetime FROM `' + tableName + '` WHERE wr_parent = ? AND wr_is_comment > 0 ORDER BY wr_datetime ASC',
            [postId]
        );

        // 첨부파일
        const [files] = await pool.query(
            'SELECT bf_no, bf_file, bf_source FROM g5_board_file WHERE bo_table = ? AND wr_id = ?',
            [board, postId]
        );

        return json({ success: true, data: { post: posts[0], comments, files } });
    } catch (error) {
        console.error('[HDBC Post] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

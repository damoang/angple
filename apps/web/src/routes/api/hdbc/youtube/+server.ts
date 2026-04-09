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

/** GET /api/hdbc/youtube — 최신 YouTube 영상 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getHdbcPool();
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);
        const [rows] = await pool.query(
            'SELECT wr_id as id, wr_subject as title, wr_link1 as link, wr_datetime as datetime FROM g5_write_youtube WHERE wr_is_comment = 0 ORDER BY wr_id DESC LIMIT ?',
            [limit]
        );
        return json({ success: true, data: rows });
    } catch (error) {
        console.error('[HDBC YouTube] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

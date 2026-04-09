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

/** GET /api/hdbc/posts?board=notice&limit=5 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getHdbcPool();
        const board = url.searchParams.get('board') || 'notice';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);
        const tableName = 'g5_write_' + board.replace(/[^a-z0-9_]/g, '');

        const [rows] = await pool.query(
            'SELECT wr_id as id, wr_subject as title, wr_name as author, wr_datetime as datetime, LEFT(wr_content, 500) as content, ? as board FROM `' + tableName + '` WHERE wr_is_comment = 0 ORDER BY wr_id DESC LIMIT ?',
            [board, limit]
        ) as any;

        // content에서 첫 이미지 추출
        const result = rows.map((r: any) => {
            const imgMatch = r.content?.match(/src="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
            return { ...r, image: imgMatch ? imgMatch[1] : null, content: undefined };
        });

        return json({ success: true, data: result });
    } catch (error) {
        console.error('[HDBC Posts] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

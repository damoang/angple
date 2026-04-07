import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/muzia/content?id=privacy — g5_content 페이지 조회 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const coId = url.searchParams.get('id');
        if (!coId) return json({ success: false, error: 'id 필요' }, { status: 400 });

        const [rows] = await pool.query(
            'SELECT co_id, co_subject, co_content, co_html, co_skin FROM g5_content WHERE co_id = ?',
            [coId]
        ) as any;

        if (rows.length === 0) {
            return json({ success: false, error: '페이지를 찾을 수 없습니다' }, { status: 404 });
        }

        return json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('[Muzia Content] error:', error);
        return json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

/** POST /api/muzia/good — 게시글 추천/비추천 */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) {
        const auth = request.headers.get('authorization');
        console.error('[Good] Auth failed. Header:', auth ? 'Bearer ...' + auth.slice(-10) : 'NONE');
        return json({ success: false, error: '로그인이 필요합니다. 새로고침 후 다시 시도해주세요.' }, { status: 401 });
    }

    const conn = await getConnection();
    try {
        const { board_id, post_id, type } = await request.json() as any;
        if (!board_id || !post_id) return json({ success: false, error: 'board_id, post_id 필요' }, { status: 400 });

        const goodType = type === 'nogood' ? 'nogood' : 'good';
        const tableName = 'g5_write_' + board_id;

        // 중복 체크
        const [existing] = await conn.query(
            'SELECT bg_id FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ? AND bg_flag = ?',
            [board_id, post_id, getMbId(user), goodType]
        ) as any;

        if (existing.length > 0) {
            conn.release();
            return json({ success: false, error: '이미 추천/비추천했습니다' }, { status: 409 });
        }

        // g5_board_good INSERT
        await conn.query(
            'INSERT INTO g5_board_good (bo_table, wr_id, mb_id, bg_flag, bg_datetime) VALUES (?, ?, ?, ?, NOW())',
            [board_id, post_id, getMbId(user), goodType]
        );

        // 게시글 카운트 업데이트
        const field = goodType === 'good' ? 'wr_good' : 'wr_nogood';
        await conn.query(
            'UPDATE `' + tableName + '` SET `' + field + '` = `' + field + '` + 1 WHERE wr_id = ?',
            [post_id]
        );

        // 현재 카운트 조회
        const [counts] = await conn.query(
            'SELECT wr_good as likes, wr_nogood as dislikes FROM `' + tableName + '` WHERE wr_id = ?',
            [post_id]
        ) as any;

        conn.release();
        return json({ success: true, data: { type: goodType, likes: counts[0]?.likes || 0, dislikes: counts[0]?.dislikes || 0 } });
    } catch (error) {
        conn.release();
        console.error('[Good] error:', error);
        return json({ success: false, error: '추천 처리 실패' }, { status: 500 });
    }
};

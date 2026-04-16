import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

/** GET /api/muzia/edit?board=dorico&id=1 — 수정용 데이터 조회 */
export const GET: RequestHandler = async ({ url, request }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    const boardId = url.searchParams.get('board');
    const postId = url.searchParams.get('id');
    if (!boardId || !postId) return json({ success: false, error: 'board, id 필요' }, { status: 400 });

    try {
        const conn = await getConnection();
        const tableName = 'g5_write_' + boardId;
        const mbId = getMbId(user);

        const [rows] = await conn.query(
            'SELECT wr_id, wr_subject, wr_content, mb_id, wr_name FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment = 0',
            [postId]
        ) as any;

        conn.release();

        if (rows.length === 0) return json({ success: false, error: '게시글 없음' }, { status: 404 });

        const post = rows[0];

        // 작성자 또는 관리자 확인
        if (post.mb_id !== mbId && (user.level || 0) < 10) {
            return json({ success: false, error: '수정 권한이 없습니다' }, { status: 403 });
        }

        return json({ success: true, data: { id: post.wr_id, title: post.wr_subject, content: post.wr_content } });
    } catch (error) {
        console.error('[Edit GET] error:', error);
        return json({ success: false, error: '조회 실패' }, { status: 500 });
    }
};

/** POST /api/muzia/edit — 게시글 수정 */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    try {
        const conn = await getConnection();
        const { board_id, post_id, title, content } = await request.json() as any;

        if (!board_id || !post_id) return json({ success: false, error: 'board_id, post_id 필요' }, { status: 400 });

        const tableName = 'g5_write_' + board_id;
        const mbId = getMbId(user);

        // 작성자 확인
        const [rows] = await conn.query(
            'SELECT mb_id FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment = 0',
            [post_id]
        ) as any;

        if (rows.length === 0) { conn.release(); return json({ success: false, error: '게시글 없음' }, { status: 404 }); }
        if (rows[0].mb_id !== mbId && (user.level || 0) < 10) {
            conn.release();
            return json({ success: false, error: '수정 권한이 없습니다' }, { status: 403 });
        }

        // 수정
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await conn.query(
            'UPDATE `' + tableName + '` SET wr_subject = ?, wr_content = ?, wr_last = ? WHERE wr_id = ?',
            [title?.trim() || '', content?.trim() || '', now, post_id]
        );

        conn.release();
        return json({ success: true, data: { id: post_id } });
    } catch (error) {
        console.error('[Edit POST] error:', error);
        return json({ success: false, error: '수정 실패' }, { status: 500 });
    }
};

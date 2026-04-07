import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

/** POST /api/muzia/comment — 댓글 등록 */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    try {
        const conn = await getConnection();
        const { board_id, post_id, content } = await request.json() as any;

        if (!board_id || !post_id || !content?.trim()) {
            return json({ success: false, error: '내용을 입력해주세요' }, { status: 400 });
        }

        const tableName = 'g5_write_' + board_id;
        const now = new Date();
        const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

        // 닉네임 조회
        const [memberRows] = await conn.query(
            'SELECT mb_nick FROM g5_member WHERE mb_id = ?', [getMbId(user)]
        ) as any;
        const nickname = memberRows[0]?.mb_nick || user.nickname || getMbId(user);

        // 댓글 삽입 — 모든 NOT NULL 필드를 빈 문자열로
        const [result] = await conn.query(
            'INSERT INTO `' + tableName + '` (wr_num, wr_reply, wr_parent, wr_is_comment, wr_comment, wr_comment_reply, ca_name, wr_option, wr_subject, wr_content, wr_link1, wr_link2, mb_id, wr_password, wr_name, wr_email, wr_homepage, wr_datetime, wr_last, wr_ip, wr_facebook_user, wr_twitter_user, wr_1, wr_2, wr_3, wr_4, wr_5, wr_6, wr_7, wr_8, wr_9, wr_10, wr_file, wr_hit, wr_good, wr_nogood) VALUES (0, \'\', ?, 1, 0, \'\', \'\', \'\', \'\', ?, \'\', \'\', ?, \'\', ?, \'\', \'\', ?, ?, \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', 0, 0, 0, 0)',
            [post_id, content.trim(), getMbId(user), nickname, nowStr, nowStr]
        ) as any;

        // 원글 댓글 수 업데이트
        await conn.query(
            'UPDATE `' + tableName + '` SET wr_comment = wr_comment + 1, wr_last = ? WHERE wr_id = ?',
            [nowStr, post_id]
        );

        return json({
            success: true,
            data: { id: result.insertId, content: content.trim(), author: nickname }
        });
    } catch (error) {
        console.error('[Comment] error:', error);
        return json({ success: false, error: '댓글 등록 실패: ' + (error as any)?.sqlMessage || '' }, { status: 500 });
    }
};

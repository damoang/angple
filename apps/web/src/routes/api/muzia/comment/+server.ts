import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

/** POST /api/muzia/comment — 댓글/대댓글 등록 */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    try {
        const conn = await getConnection();
        const { board_id, post_id, content, comment_id } = await request.json() as any;

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

        let wrComment = 0;
        let wrCommentReply = '';

        if (comment_id) {
            // 대댓글: 부모 댓글 조회
            const [parentRows] = await conn.query(
                'SELECT wr_id, wr_comment, wr_comment_reply FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment > 0',
                [comment_id]
            ) as any;

            if (parentRows.length === 0) {
                return json({ success: false, error: '부모 댓글을 찾을 수 없습니다' }, { status: 404 });
            }

            const parent = parentRows[0];
            wrComment = parent.wr_comment;
            const parentReply = parent.wr_comment_reply || '';
            const replyLen = parentReply.length + 1;

            // 같은 부모 아래 마지막 대댓글 찾기
            const [lastRows] = await conn.query(
                'SELECT wr_comment_reply FROM `' + tableName + '` WHERE wr_parent = ? AND wr_is_comment > 0 AND wr_comment = ? AND LENGTH(wr_comment_reply) = ? AND wr_comment_reply LIKE ? ORDER BY wr_comment_reply DESC LIMIT 1',
                [post_id, wrComment, replyLen, parentReply + '%']
            ) as any;

            if (lastRows.length === 0) {
                wrCommentReply = parentReply + 'A';
            } else {
                const lastReply = lastRows[0].wr_comment_reply;
                const lastChar = lastReply.charCodeAt(lastReply.length - 1);
                if (lastChar < 90) { // 'Z' = 90
                    wrCommentReply = parentReply + String.fromCharCode(lastChar + 1);
                } else {
                    return json({ success: false, error: '대댓글 한도 초과 (최대 26개)' }, { status: 400 });
                }
            }
        } else {
            // 루트 댓글: MAX(wr_comment) + 1
            const [maxRows] = await conn.query(
                'SELECT COALESCE(MAX(wr_comment), 0) as max_comment FROM `' + tableName + '` WHERE wr_parent = ? AND wr_is_comment > 0',
                [post_id]
            ) as any;
            wrComment = (maxRows[0]?.max_comment || 0) + 1;
            wrCommentReply = '';
        }

        // 댓글 삽입
        const [result] = await conn.query(
            'INSERT INTO `' + tableName + '` (wr_num, wr_reply, wr_parent, wr_is_comment, wr_comment, wr_comment_reply, ca_name, wr_option, wr_subject, wr_content, wr_link1, wr_link2, mb_id, wr_password, wr_name, wr_email, wr_homepage, wr_datetime, wr_last, wr_ip, wr_facebook_user, wr_twitter_user, wr_1, wr_2, wr_3, wr_4, wr_5, wr_6, wr_7, wr_8, wr_9, wr_10, wr_file, wr_hit, wr_good, wr_nogood) VALUES (0, \'\', ?, 1, ?, ?, \'\', \'\', \'\', ?, \'\', \'\', ?, \'\', ?, \'\', \'\', ?, ?, \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', 0, 0, 0, 0)',
            [post_id, wrComment, wrCommentReply, content.trim(), getMbId(user), nickname, nowStr, nowStr]
        ) as any;

        // 원글 댓글 수 업데이트
        await conn.query(
            'UPDATE `' + tableName + '` SET wr_comment = wr_comment + 1, wr_last = ? WHERE wr_id = ? AND wr_is_comment = 0',
            [nowStr, post_id]
        );

        return json({
            success: true,
            data: { id: result.insertId, content: content.trim(), author: nickname, wr_comment: wrComment, wr_comment_reply: wrCommentReply }
        });
    } catch (error) {
        console.error('[Comment] error:', error);
        return json({ success: false, error: '댓글 등록 실패: ' + ((error as any)?.sqlMessage || '') }, { status: 500 });
    }
};

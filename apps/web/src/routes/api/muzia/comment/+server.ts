import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';
import { createNotification, extractMentions } from '$lib/server/db/notification';

/** POST /api/muzia/comment — 댓글/대댓글 등록 + 알림 */
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
        const senderMbId = getMbId(user);

        // 닉네임 조회
        const [memberRows] = await conn.query(
            'SELECT mb_nick FROM g5_member WHERE mb_id = ?', [senderMbId]
        ) as any;
        const nickname = memberRows[0]?.mb_nick || user.nickname || senderMbId;

        let wrComment = 0;
        let wrCommentReply = '';
        let parentCommentAuthor: string | null = null;

        if (comment_id) {
            // 대댓글: 부모 댓글 조회
            const [parentRows] = await conn.query(
                'SELECT wr_id, wr_comment, wr_comment_reply, mb_id FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment > 0',
                [comment_id]
            ) as any;

            if (parentRows.length === 0) {
                return json({ success: false, error: '부모 댓글을 찾을 수 없습니다' }, { status: 404 });
            }

            const parent = parentRows[0];
            wrComment = parent.wr_comment;
            parentCommentAuthor = parent.mb_id;
            const parentReply = parent.wr_comment_reply || '';
            const replyLen = parentReply.length + 1;

            const [lastRows] = await conn.query(
                'SELECT wr_comment_reply FROM `' + tableName + '` WHERE wr_parent = ? AND wr_is_comment > 0 AND wr_comment = ? AND LENGTH(wr_comment_reply) = ? AND wr_comment_reply LIKE ? ORDER BY wr_comment_reply DESC LIMIT 1',
                [post_id, wrComment, replyLen, parentReply + '%']
            ) as any;

            if (lastRows.length === 0) {
                wrCommentReply = parentReply + 'A';
            } else {
                const lastReply = lastRows[0].wr_comment_reply;
                const lastChar = lastReply.charCodeAt(lastReply.length - 1);
                if (lastChar < 90) {
                    wrCommentReply = parentReply + String.fromCharCode(lastChar + 1);
                } else {
                    return json({ success: false, error: '대댓글 한도 초과 (최대 26개)' }, { status: 400 });
                }
            }
        } else {
            const [maxRows] = await conn.query(
                'SELECT COALESCE(MAX(wr_comment), 0) as max_comment FROM `' + tableName + '` WHERE wr_parent = ? AND wr_is_comment > 0',
                [post_id]
            ) as any;
            wrComment = (maxRows[0]?.max_comment || 0) + 1;
        }

        // 댓글 삽입
        const [result] = await conn.query(
            'INSERT INTO `' + tableName + '` (wr_num, wr_reply, wr_parent, wr_is_comment, wr_comment, wr_comment_reply, ca_name, wr_option, wr_subject, wr_content, wr_link1, wr_link2, mb_id, wr_password, wr_name, wr_email, wr_homepage, wr_datetime, wr_last, wr_ip, wr_facebook_user, wr_twitter_user, wr_1, wr_2, wr_3, wr_4, wr_5, wr_6, wr_7, wr_8, wr_9, wr_10, wr_file, wr_hit, wr_good, wr_nogood) VALUES (0, \'\', ?, 1, ?, ?, \'\', \'\', \'\', ?, \'\', \'\', ?, \'\', ?, \'\', \'\', ?, ?, \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', \'\', 0, 0, 0, 0)',
            [post_id, wrComment, wrCommentReply, content.trim(), senderMbId, nickname, nowStr, nowStr]
        ) as any;

        // 원글 댓글 수 업데이트
        await conn.query(
            'UPDATE `' + tableName + '` SET wr_comment = wr_comment + 1, wr_last = ? WHERE wr_id = ? AND wr_is_comment = 0',
            [nowStr, post_id]
        );

        // === 알림 처리 (비동기, 실패해도 댓글은 성공) ===
        try {
            const postUrl = `/${board_id}/${post_id}`;
            const excerpt = content.trim().replace(/<[^>]*>/g, '').slice(0, 50);

            // 원글 작성자 조회
            const [postRows] = await conn.query(
                'SELECT mb_id, wr_subject FROM `' + tableName + '` WHERE wr_id = ? AND wr_is_comment = 0',
                [post_id]
            ) as any;
            const postAuthor = postRows[0]?.mb_id;
            const postTitle = postRows[0]?.wr_subject || '';

            // 1. 원글 작성자에게 댓글 알림
            if (postAuthor && !comment_id) {
                await createNotification(conn, {
                    mb_id: postAuthor,
                    type: 'comment',
                    sender_id: senderMbId,
                    sender_name: nickname,
                    title: `${nickname}님이 "${postTitle}" 글에 댓글을 남겼습니다`,
                    content: excerpt,
                    url: postUrl,
                });
            }

            // 2. 대댓글 → 부모 댓글 작성자에게 답글 알림
            if (parentCommentAuthor) {
                await createNotification(conn, {
                    mb_id: parentCommentAuthor,
                    type: 'reply',
                    sender_id: senderMbId,
                    sender_name: nickname,
                    title: `${nickname}님이 회원님의 댓글에 답글을 남겼습니다`,
                    content: excerpt,
                    url: postUrl,
                });
                // 원글 작성자에게도 (부모 댓글 작성자 ≠ 원글 작성자인 경우)
                if (postAuthor && postAuthor !== parentCommentAuthor) {
                    await createNotification(conn, {
                        mb_id: postAuthor,
                        type: 'comment',
                        sender_id: senderMbId,
                        sender_name: nickname,
                        title: `${nickname}님이 "${postTitle}" 글에 댓글을 남겼습니다`,
                        content: excerpt,
                        url: postUrl,
                    });
                }
            }

            // 3. @멘션 알림
            const mentions = extractMentions(content);
            if (mentions.length > 0) {
                for (const mentionName of mentions.slice(0, 10)) {
                    const [mentionRows] = await conn.query(
                        'SELECT mb_id FROM g5_member WHERE mb_nick = ? OR mb_id = ? LIMIT 1',
                        [mentionName, mentionName]
                    ) as any;
                    if (mentionRows.length > 0) {
                        await createNotification(conn, {
                            mb_id: mentionRows[0].mb_id,
                            type: 'mention',
                            sender_id: senderMbId,
                            sender_name: nickname,
                            title: `${nickname}님이 회원님을 멘션했습니다`,
                            content: excerpt,
                            url: postUrl,
                        });
                    }
                }
            }
        } catch (notiErr) {
            console.error('[Comment] notification error (ignored):', notiErr);
        }

        return json({
            success: true,
            data: { id: result.insertId, content: content.trim(), author: nickname, wr_comment: wrComment, wr_comment_reply: wrCommentReply }
        });
    } catch (error) {
        console.error('[Comment] error:', error);
        return json({ success: false, error: '댓글 등록 실패: ' + ((error as any)?.sqlMessage || '') }, { status: 500 });
    }
};

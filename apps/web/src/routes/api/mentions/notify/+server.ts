/**
 * 멘션 알림 생성 API
 * POST /api/mentions/notify
 * 멘션된 회원에게 g5_na_noti 테이블에 직접 알림 INSERT
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface NotifyRequest {
    mentions: string[]; // 닉네임 배열
    boardId: string;
    postId: number;
    commentId?: number;
    content: string; // 원본 내용 (발췌용)
    senderNick: string; // 발신자 닉네임
    senderId: string; // 발신자 mb_id
    postTitle?: string; // 게시글 제목
}

/** HTML 태그를 반복 제거 (중첩 태그 우회 방지) */
function stripHtmlTags(str: string): string {
    let result = str;
    let prev;
    do {
        prev = result;
        result = result.replace(/<[^>]+>/g, '');
    } while (result !== prev);
    return result;
}

export const POST: RequestHandler = async ({ request }) => {
    const body: NotifyRequest = await request.json();
    const { mentions, boardId, postId, commentId, content, senderNick, senderId, postTitle } = body;

    if (!mentions || mentions.length === 0) {
        return json({ sent: 0 });
    }

    if (!boardId || !postId) {
        return json({ error: 'boardId, postId 필수' }, { status: 400 });
    }

    if (!senderId) {
        return json({ error: 'senderId 필수' }, { status: 400 });
    }

    // 닉네임 유효성 검사
    const validNicks = mentions
        .filter((nick) => nick && nick.length > 0 && nick.length <= 50)
        .slice(0, 20); // 최대 20명

    if (validNicks.length === 0) {
        return json({ sent: 0 });
    }

    try {
        // 닉네임으로 mb_id 조회
        const placeholders = validNicks.map(() => '?').join(',');
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id, mb_nick FROM g5_member WHERE mb_nick IN (${placeholders}) AND mb_leave_date = ''`,
            validNicks
        );

        if (rows.length === 0) {
            return json({ sent: 0 });
        }

        // 자기 자신 제외
        const receivers = rows.filter((row) => row.mb_id !== senderId);
        if (receivers.length === 0) {
            return json({ sent: 0 });
        }

        // 알림 설정 확인 (noti_mention = false인 유저 제외)
        const receiverIds = receivers.map((r) => r.mb_id);
        const prefPlaceholders = receiverIds.map(() => '?').join(',');
        const [prefRows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id, noti_mention FROM g5_noti_preference WHERE mb_id IN (${prefPlaceholders})`,
            receiverIds
        );
        const prefMap = new Map<string, boolean>();
        for (const pref of prefRows) {
            prefMap.set(pref.mb_id, Boolean(pref.noti_mention));
        }

        // 중복 알림 방지: 동일 게시글+댓글+발신자+mention 조합 체크
        const wrId = commentId || postId;
        const [existingRows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id FROM g5_na_noti WHERE bo_table = ? AND wr_id = ? AND rel_mb_id = ? AND ph_from_case = 'mention' AND mb_id IN (${prefPlaceholders})`,
            [boardId, wrId, senderId, ...receiverIds]
        );
        const alreadyNotified = new Set(existingRows.map((r: RowDataPacket) => r.mb_id));

        const url = commentId
            ? `/${boardId}/${postId}#comment-${commentId}`
            : `/${boardId}/${postId}`;
        const excerpt = stripHtmlTags(content).substring(0, 80);
        let sentCount = 0;

        for (const receiver of receivers) {
            // 알림 설정 체크 (설정 없으면 기본 활성)
            const mentionEnabled = prefMap.get(receiver.mb_id) ?? true;
            if (!mentionEnabled) continue;

            // 중복 체크
            if (alreadyNotified.has(receiver.mb_id)) continue;

            try {
                await pool.execute(
                    `INSERT INTO g5_na_noti (ph_to_case, ph_from_case, bo_table, wr_id, mb_id, rel_mb_id, rel_mb_nick, rel_msg, rel_url, ph_readed, ph_datetime, parent_subject, wr_parent)
					 VALUES ('mention', 'mention', ?, ?, ?, ?, ?, ?, ?, 'N', NOW(), ?, ?)`,
                    [
                        boardId,
                        wrId,
                        receiver.mb_id,
                        senderId,
                        senderNick,
                        excerpt,
                        url,
                        postTitle || '',
                        postId
                    ]
                );
                sentCount++;
            } catch (err) {
                console.error('멘션 알림 INSERT 실패 (%s):', receiver.mb_nick, err);
            }
        }

        return json({ sent: sentCount });
    } catch (error) {
        console.error('Mention notify API error:', error);
        return json({ error: '멘션 알림 전송 실패' }, { status: 500 });
    }
};

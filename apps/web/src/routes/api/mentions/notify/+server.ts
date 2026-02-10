/**
 * 멘션 알림 생성 API
 * POST /api/mentions/notify
 * 멘션된 회원에게 Go 백엔드를 통해 알림을 생성
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8082/api/v1';

interface NotifyRequest {
    mentions: string[]; // 닉네임 배열
    boardId: string;
    postId: number;
    commentId?: number;
    content: string; // 원본 내용 (발췌용)
    senderNick: string; // 발신자 닉네임
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    const accessToken =
        cookies.get('access_token') || request.headers.get('authorization')?.replace('Bearer ', '');

    const body: NotifyRequest = await request.json();
    const { mentions, boardId, postId, commentId, content, senderNick } = body;

    if (!mentions || mentions.length === 0) {
        return json({ sent: 0 });
    }

    if (!boardId || !postId) {
        return json({ error: 'boardId, postId 필수' }, { status: 400 });
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
            `SELECT mb_id, mb_nick FROM g5_member WHERE mb_nick IN (${placeholders}) AND mb_leave_dt = ''`,
            validNicks
        );

        if (rows.length === 0) {
            return json({ sent: 0 });
        }

        // 각 멘션 대상에게 알림 생성 (Go 백엔드 호출)
        const url = commentId
            ? `/${boardId}/${postId}#comment-${commentId}`
            : `/${boardId}/${postId}`;

        const excerpt = content.replace(/<[^>]+>/g, '').substring(0, 80);
        let sentCount = 0;

        for (const row of rows) {
            try {
                const notificationPayload = {
                    type: 'mention',
                    receiver_id: row.mb_id,
                    title: `@${senderNick}님이 회원님을 멘션했습니다`,
                    content: excerpt,
                    url
                };

                const res = await fetch(`${INTERNAL_API_URL}/notifications`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
                    },
                    body: JSON.stringify(notificationPayload)
                });

                if (res.ok) {
                    sentCount++;
                }
            } catch (err) {
                console.error(`멘션 알림 전송 실패 (${row.mb_nick}):`, err);
            }
        }

        return json({ sent: sentCount });
    } catch (error) {
        console.error('Mention notify API error:', error);
        return json({ error: '멘션 알림 전송 실패' }, { status: 500 });
    }
};

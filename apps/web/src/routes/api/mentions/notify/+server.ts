import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { extractMentions } from '$lib/utils/mention-parser.js';
import { pool } from '$lib/server/db.js';

/**
 * @멘션 알림 생성 API
 *
 * POST /api/mentions/notify
 * Body: { content, postUrl, postTitle, boardId, postId, senderName, senderId }
 *
 * content에서 @멘션을 추출하여 해당 회원에게 알림 생성
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { content, postUrl, postTitle, senderName, senderId } = body;

        if (!content) {
            return json({ error: 'content가 필요합니다.' }, { status: 400 });
        }

        const mentions = extractMentions(content);
        if (mentions.length === 0) {
            return json({ sent: 0 });
        }

        // 멘션된 닉네임으로 회원 ID 조회 (자기 자신 제외)
        const placeholders = mentions.map(() => '?').join(',');
        const [rows] = await pool.execute(
            `SELECT mb_id, mb_nick FROM g5_member WHERE mb_nick IN (${placeholders}) AND mb_id != ?`,
            [...mentions, senderId || '']
        );

        const members = rows as Array<{ mb_id: string; mb_nick: string }>;
        if (members.length === 0) {
            return json({ sent: 0 });
        }

        // 알림 생성
        const values = members.map((m) => [
            m.mb_id,
            'mention',
            `${senderName || '누군가'}님이 회원님을 멘션했습니다`,
            postTitle ? `${postTitle}에서 멘션됨` : '멘션됨',
            postUrl || '',
            senderId || '',
            senderName || ''
        ]);

        const insertPlaceholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, NOW(), 0)').join(',');
        const flatValues = values.flat();

        await pool.execute(
            `INSERT INTO g5_notification (mb_id, type, title, content, url, sender_id, sender_name, created_at, is_read) VALUES ${insertPlaceholders}`,
            flatValues
        );

        return json({ sent: members.length });
    } catch (err) {
        console.error('[mention-notify] 알림 생성 실패:', err);
        return json({ sent: 0, error: '알림 생성 실패' }, { status: 500 });
    }
};

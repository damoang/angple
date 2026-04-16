/**
 * muzia 알림 생성 유틸리티
 * g5_da_notification 테이블에 INSERT
 */

import type { Pool, PoolConnection } from 'mysql2/promise';

interface NotificationParams {
    mb_id: string;          // 수신자 mb_id
    type: 'comment' | 'reply' | 'mention' | 'like' | 'system';
    sender_id: string;      // 발신자 mb_id
    sender_name: string;    // 발신자 닉네임
    title: string;          // 알림 제목
    content: string;        // 알림 내용 (미리보기)
    url: string;            // 클릭 시 이동 URL
}

export async function createNotification(conn: PoolConnection | Pool, params: NotificationParams) {
    const { mb_id, type, sender_id, sender_name, title, content, url } = params;

    // 자기 자신에게는 알림 안 보냄
    if (mb_id === sender_id) return;

    try {
        await (conn as any).query(
            `INSERT INTO g5_da_notification (mb_id, nt_type, nt_title, nt_content, nt_url, nt_sender_id, nt_sender_name, nt_is_read, nt_created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [mb_id, type, title, content.slice(0, 200), url, sender_id, sender_name]
        );
    } catch (e) {
        console.error('[Notification] insert error:', e);
    }
}

/** 댓글에서 @멘션 추출 */
export function extractMentions(content: string): string[] {
    const regex = /@([a-zA-Z0-9_가-힣]+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        if (!mentions.includes(match[1])) mentions.push(match[1]);
    }
    return mentions;
}

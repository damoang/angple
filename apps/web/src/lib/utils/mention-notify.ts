import { extractMentions } from './mention-parser.js';

interface MentionNotifyParams {
    content: string;
    postUrl: string;
    postTitle: string;
    boardId: string;
    postId: number | string;
    senderName: string;
    senderId: string;
}

/**
 * 게시글/댓글 내 @멘션된 사용자에게 알림 전송
 * 멘션이 없으면 아무 것도 하지 않음 (fire-and-forget)
 */
export async function sendMentionNotifications(params: MentionNotifyParams): Promise<void> {
    const mentions = extractMentions(params.content);
    if (mentions.length === 0) return;

    try {
        await fetch('/api/mentions/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(params)
        });
    } catch {
        // fire-and-forget: 멘션 알림 실패는 무시
    }
}

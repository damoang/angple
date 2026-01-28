/**
 * 멘션 알림 전송 Hook
 * 댓글 제출 후 멘션된 사용자에게 알림 전송
 */

import { getUniqueMentionedUsers } from './parse-mentions';

/**
 * 알림 데이터 인터페이스
 */
export interface MentionNotification {
    type: 'mention';
    targetUserId: string;
    sourceUserId: string;
    commentId: string;
    postId: string;
    excerpt: string;
    createdAt: Date;
}

/**
 * 댓글 데이터 인터페이스
 */
interface CommentData {
    id?: string;
    content: string;
    authorId: string;
    postId: string;
}

/**
 * API 응답 인터페이스
 */
interface CommentResponse {
    success: boolean;
    commentId?: string;
}

/**
 * 멘션 알림 전송
 * 댓글이 성공적으로 제출된 후 실행되어 멘션된 사용자들에게 알림 전송
 *
 * @param commentData - 제출된 댓글 데이터
 * @param response - 댓글 제출 API 응답
 */
export async function sendMentionNotification(
    commentData: CommentData,
    response: CommentResponse
): Promise<void> {
    // 댓글 제출 실패 시 알림 전송하지 않음
    if (!response.success) {
        return;
    }

    const mentionedUsers = getUniqueMentionedUsers(commentData.content);

    if (mentionedUsers.length === 0) {
        return;
    }

    // 자기 자신 멘션 제외
    const usersToNotify = mentionedUsers.filter((username) => username !== commentData.authorId);

    if (usersToNotify.length === 0) {
        return;
    }

    console.log(`[Mention] ${usersToNotify.length}명에게 알림 전송 예정:`, usersToNotify);

    // 각 사용자에게 알림 전송
    for (const username of usersToNotify) {
        try {
            await sendNotificationToUser(username, {
                type: 'mention',
                targetUserId: username,
                sourceUserId: commentData.authorId,
                commentId: response.commentId || commentData.id || '',
                postId: commentData.postId,
                excerpt: getExcerpt(commentData.content, 100),
                createdAt: new Date()
            });

            console.log(`[Mention] 알림 전송 완료: @${username}`);
        } catch (error) {
            console.error(`[Mention] 알림 전송 실패: @${username}`, error);
        }
    }
}

/**
 * 개별 사용자에게 알림 전송
 * (실제 구현에서는 API 호출 또는 WebSocket 사용)
 */
async function sendNotificationToUser(
    username: string,
    notification: MentionNotification
): Promise<void> {
    // TODO: 실제 알림 API 호출 구현
    // 예: await fetch('/api/notifications', { method: 'POST', body: JSON.stringify(notification) });

    // 현재는 콘솔 로그로 대체
    console.log(`[Notification] @${username}에게 멘션 알림:`, notification);
}

/**
 * 텍스트에서 발췌문 생성
 */
function getExcerpt(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
        return content;
    }

    return content.substring(0, maxLength - 3) + '...';
}

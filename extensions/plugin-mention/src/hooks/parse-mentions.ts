/**
 * 멘션 파싱 Hook
 * 댓글 내용에서 @username 패턴을 감지하여 링크로 변환
 */

/**
 * 멘션 정규식
 * @로 시작하고, 영문/숫자/언더스코어로 구성된 사용자명 매칭
 */
export const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g;

/**
 * 멘션 정보 인터페이스
 */
export interface MentionInfo {
    username: string;
    startIndex: number;
    endIndex: number;
}

/**
 * 댓글 내용에서 멘션을 파싱하고 링크로 변환
 *
 * @param content - 원본 댓글 내용
 * @param comment - 댓글 메타데이터 (선택적)
 * @returns 멘션이 링크로 변환된 내용
 *
 * @example
 * parseMentions("안녕하세요 @john님!");
 * // 결과: '안녕하세요 <a href="/users/john" class="mention">@john</a>님!'
 */
export function parseMentions(content: string, comment?: any): string {
    if (!content || typeof content !== 'string') {
        return content;
    }

    // 멘션을 링크로 변환
    const transformed = content.replace(MENTION_REGEX, (match, username) => {
        const userProfileUrl = `/users/${encodeURIComponent(username)}`;
        return `<a href="${userProfileUrl}" class="mention text-blue-600 hover:underline">@${username}</a>`;
    });

    return transformed;
}

/**
 * 댓글에서 모든 멘션 추출
 *
 * @param content - 댓글 내용
 * @returns 멘션 정보 배열
 */
export function extractMentions(content: string): MentionInfo[] {
    if (!content || typeof content !== 'string') {
        return [];
    }

    const mentions: MentionInfo[] = [];
    let match: RegExpExecArray | null;

    // 정규식 lastIndex 초기화
    const regex = new RegExp(MENTION_REGEX.source, 'g');

    while ((match = regex.exec(content)) !== null) {
        mentions.push({
            username: match[1],
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }

    return mentions;
}

/**
 * 멘션된 사용자명 목록만 추출 (중복 제거)
 *
 * @param content - 댓글 내용
 * @returns 고유한 사용자명 배열
 */
export function getUniqueMentionedUsers(content: string): string[] {
    const mentions = extractMentions(content);
    const uniqueUsers = [...new Set(mentions.map((m) => m.username))];
    return uniqueUsers;
}

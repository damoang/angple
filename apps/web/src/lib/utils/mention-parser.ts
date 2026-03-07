/**
 * @멘션 파싱 유틸리티
 * plain text 및 HTML에서 @멘션을 추출하고 변환
 */

/** 멘션 정규식: @닉네임 패턴 — URL/이메일 내 @는 제외 */
const MENTION_REGEX = /(?<![a-zA-Z0-9.+_\-/])@([a-zA-Z0-9_가-힣]+)/g;

/** HTML data-mention 속성에서 멘션 추출 정규식 */
const HTML_MENTION_REGEX = /data-mention="([^"]+)"/g;

/**
 * plain text 또는 HTML에서 멘션된 닉네임 추출 (중복 제거)
 * HTML 태그 내부 및 URL/이메일 내 @는 무시
 */
export function extractMentions(content: string): string[] {
    if (!content) return [];

    const mentions = new Set<string>();

    // HTML data-mention 속성에서 추출
    let match: RegExpExecArray | null;
    const htmlRegex = new RegExp(HTML_MENTION_REGEX.source, 'g');
    while ((match = htmlRegex.exec(content)) !== null) {
        mentions.add(match[1]);
    }

    // HTML 태그를 제거한 텍스트에서 @닉네임 추출
    const textOnly = content.replace(/<[^>]+>/g, ' ');
    const textRegex = new RegExp(MENTION_REGEX.source, 'g');
    while ((match = textRegex.exec(textOnly)) !== null) {
        mentions.add(match[1]);
    }

    return [...mentions];
}

/**
 * plain text의 @닉네임을 클릭 가능한 링크로 변환
 * DOMPurify를 통과할 수 있도록 <a> 태그 사용
 * HTML 태그 내부 및 URL/이메일 내 @는 변환하지 않음
 */
export function highlightMentions(content: string): string {
    if (!content) return content;

    // HTML 태그를 분리하여 텍스트 노드에서만 변환
    const parts = content.split(/(<[^>]+>)/g);
    return parts
        .map((part) => {
            if (part.startsWith('<')) return part;
            return part.replace(
                /(?<![a-zA-Z0-9.+_\-/])@([a-zA-Z0-9_가-힣]+)/g,
                (_match, nick) =>
                    `<a href="/profile/${encodeURIComponent(nick)}" class="mention-link text-primary font-medium hover:underline" data-mention="${nick}">@${nick}</a>`
            );
        })
        .join('');
}

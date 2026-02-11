/**
 * 서버사이드 HTML 정제 (XSS 방지)
 *
 * isomorphic-dompurify 사용 — SSR 환경에서 JSDOM 기반 동작
 */
import DOMPurify from 'isomorphic-dompurify';

/** YouTube 도메인 허용 패턴 */
const YOUTUBE_REGEX = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\//;

/**
 * 게시글 본문 HTML 정제
 * 허용: 기본 서식, 이미지, 링크, 테이블, iframe(YouTube만)
 */
export function sanitizePostContent(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'p',
            'br',
            'strong',
            'b',
            'em',
            'i',
            'u',
            's',
            'del',
            'ul',
            'ol',
            'li',
            'blockquote',
            'code',
            'pre',
            'a',
            'img',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'hr',
            'div',
            'span',
            'iframe',
            'video',
            'audio',
            'source',
            'figure',
            'figcaption'
        ],
        ALLOWED_ATTR: [
            'href',
            'src',
            'alt',
            'title',
            'class',
            'target',
            'rel',
            'width',
            'height',
            'loading',
            'style',
            'frameborder',
            'allow',
            'allowfullscreen',
            'referrerpolicy',
            'type',
            'controls',
            'autoplay',
            'muted',
            'loop',
            'playsinline',
            'start',
            'colspan',
            'rowspan'
        ],
        ALLOW_DATA_ATTR: false,
        // javascript: 프로토콜 차단
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
    });
}

/**
 * iframe src를 YouTube만 허용하도록 후처리
 * DOMPurify 훅 대신 정제 후 검증
 */
export function sanitizePostContentStrict(html: string): string {
    let sanitized = sanitizePostContent(html);

    // iframe src가 YouTube가 아닌 경우 반복 제거 (중첩 태그 우회 방지)
    let prev;
    do {
        prev = sanitized;
        sanitized = sanitized.replace(
            /<iframe\s[^>]*src="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi,
            (match, src: string) => {
                if (YOUTUBE_REGEX.test(src)) {
                    return match;
                }
                return '';
            }
        );
    } while (sanitized !== prev);

    return sanitized;
}

/**
 * 댓글 텍스트 정제 (더 제한적)
 * 허용: 기본 서식만 (이미지, iframe 불가)
 */
export function sanitizeComment(text: string): string {
    const sanitized = DOMPurify.sanitize(text, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'a', 'code', 's', 'del'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
    });

    // a 태그에 rel="nofollow noopener" 강제
    return sanitized.replace(/<a\s([^>]*)>/gi, (match, attrs: string) => {
        // 기존 rel 제거 후 재추가
        const cleaned = attrs.replace(/\s*rel="[^"]*"/gi, '');
        return `<a ${cleaned} rel="nofollow noopener" target="_blank">`;
    });
}

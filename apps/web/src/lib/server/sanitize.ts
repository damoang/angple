/**
 * 서버사이드 HTML 정제 (XSS 방지)
 *
 * isomorphic-dompurify 사용 — SSR 환경에서 JSDOM 기반 동작
 */
import { dompurify as DOMPurify } from '$lib/utils/dompurify.js';
import { filterUnsafeStyles } from '$lib/utils/safe-css.js';

/**
 * URL에서 도메인 추출 (프로토콜, www, 경로 제거)
 */
function extractDomain(url: string): string | null {
    try {
        // 상대 경로는 도메인 없음
        if (url.startsWith('/') || url.startsWith('#')) {
            return null;
        }
        // 프로토콜 없으면 추가
        let normalizedUrl = url;
        if (!url.match(/^https?:\/\//i)) {
            normalizedUrl = 'https://' + url;
        }
        const parsed = new URL(normalizedUrl);
        return parsed.hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return null;
    }
}

/**
 * 텍스트가 URL 형식인지 확인
 */
function isUrlLikeText(text: string): boolean {
    const trimmed = text.trim();
    // URL 형태: http://, https://, www. 또는 도메인.TLD 패턴
    return /^(https?:\/\/|www\.)/i.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed);
}

/**
 * 링크 텍스트와 href의 도메인이 일치하는지 확인
 * - 텍스트가 URL 형식이 아니면 true 반환 (체크 불필요)
 * - 텍스트와 href의 도메인이 같으면 true 반환
 * - 다르면 false 반환 (경고 표시 필요)
 */
export function isLinkDomainMatch(href: string, text: string): boolean {
    const trimmedText = text.trim();

    // 텍스트가 URL 형식이 아니면 체크 불필요
    if (!isUrlLikeText(trimmedText)) {
        return true;
    }

    const hrefDomain = extractDomain(href);
    const textDomain = extractDomain(trimmedText);

    // 도메인 추출 실패 시 체크 불필요
    if (!hrefDomain || !textDomain) {
        return true;
    }

    // 도메인 비교 (서브도메인 무시, 루트 도메인만 비교)
    // 예: blog.example.com vs example.com → 일치로 처리
    const hrefRoot = hrefDomain.split('.').slice(-2).join('.');
    const textRoot = textDomain.split('.').slice(-2).join('.');

    return hrefRoot === textRoot;
}

// CSS 필터 훅 등록 — style 속성에서 위험한 CSS 속성 제거
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    filterUnsafeStyles(node as unknown as Element);
});

/** 허용 iframe 도메인 패턴 */
const ALLOWED_IFRAME_REGEX =
    /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|platform\.twitter\.com|syndication\.twitter\.com|platform\.x\.com|embed\.bsky\.app|instagram\.com|player\.vimeo\.com|open\.spotify\.com|codepen\.io|tiktok\.com)\//;

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
            'preload',
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

    // iframe src가 허용 도메인이 아닌 경우 반복 제거 (중첩 태그 우회 방지)
    let prev;
    do {
        prev = sanitized;
        sanitized = sanitized.replace(
            /<iframe\s[^>]*src="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi,
            (match, src: string) => {
                if (ALLOWED_IFRAME_REGEX.test(src)) {
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

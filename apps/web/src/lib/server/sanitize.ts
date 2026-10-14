/**
 * 서버사이드 HTML 정제 (XSS 방지)
 *
 * isomorphic-dompurify 사용 — SSR 환경에서 JSDOM 기반 동작
 */
import { dompurify as DOMPurify } from '$lib/utils/dompurify.js';

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

/** 허용 iframe 도메인 패턴 */
const ALLOWED_IFRAME_REGEX =
    /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|platform\.twitter\.com|syndication\.twitter\.com|platform\.x\.com|embed\.bsky\.app|instagram\.com|player\.vimeo\.com|open\.spotify\.com|codepen\.io|tiktok\.com)\//;

/**
 * iframe 허용 도메인 정책
 * - allow: src 값이 맞아야 하는 패턴
 * - removeWithoutSrc: src 속성이 없는 iframe 도 제거할지
 */
interface IframePolicy {
    allow: RegExp;
    removeWithoutSrc: boolean;
}

const POST_IFRAME_POLICY: IframePolicy = { allow: ALLOWED_IFRAME_REGEX, removeWithoutSrc: false };

/**
 * 현재 진행 중인 정화 호출에 적용할 iframe 정책.
 * withIframePolicy() 안에서만 설정되므로 다른 sanitize 호출에는 영향이 없다.
 * DOMPurify.sanitize 는 동기 함수라 설정→정화→복원 사이에 다른 요청이 끼어들지 않는다.
 */
let activeIframePolicy: IframePolicy | null = null;

/** 정화가 끝난 속성 기준으로 iframe 의 src 를 정책과 대조해 허용 밖이면 노드를 제거한다. */
function enforceIframePolicy(node: Element): void {
    const policy = activeIframePolicy;
    if (!policy || typeof node.nodeName !== 'string') return;
    if (node.nodeName.toLowerCase() !== 'iframe') return;

    const src = node.getAttribute('src');
    const keep = src === null ? !policy.removeWithoutSrc : policy.allow.test(src);
    if (keep) return;

    if (node.parentNode) {
        node.parentNode.removeChild(node);
    } else {
        node.remove();
    }
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    enforceIframePolicy(node as unknown as Element);
});

/** 주어진 iframe 정책을 이 정화 호출에만 적용한다 (예외가 나도 finally 에서 복원). */
function withIframePolicy<T>(policy: IframePolicy, run: () => T): T {
    const previous = activeIframePolicy;
    activeIframePolicy = policy;
    try {
        return run();
    } finally {
        activeIframePolicy = previous;
    }
}

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
 * 게시글 본문 HTML 정제 + iframe 허용 도메인 검사
 * iframe 은 src 가 ALLOWED_IFRAME_REGEX 에 맞을 때만 남긴다 (src 없는 iframe 은 그대로 둔다).
 * 검사는 DOMPurify 훅에서 DOM 노드의 src 속성으로 판정한다.
 */
export function sanitizePostContentStrict(html: string): string {
    return withIframePolicy(POST_IFRAME_POLICY, () => sanitizePostContent(html));
}

/** 소모임 소개(상단 커스텀 영역) 전용 iframe 화이트리스트 — 구글 캘린더만. */
const INTRO_IFRAME_REGEX = /^https:\/\/calendar\.google\.com\//;

const INTRO_IFRAME_POLICY: IframePolicy = { allow: INTRO_IFRAME_REGEX, removeWithoutSrc: true };

/**
 * 소모임 소개글(게시판 상단 커스텀 영역) HTML 정제
 *
 * 당주가 작성한 HTML 이 모든 방문자에게 렌더되므로 게시글 본문보다 좁게 연다:
 * 기본 서식 + 이미지(https만) + iframe(구글 캘린더만). script·style·이벤트 핸들러
 * 불가. iframe 은 sanitizePostContentStrict 와 같은 DOMPurify 훅으로 src 를 검사하고,
 * src 가 없는 iframe 도 제거한다.
 * CSP frame-src 가 2차 방어선이다 (hooks.server.ts).
 */
export function sanitizeIntroHtml(html: string): string {
    return withIframePolicy(INTRO_IFRAME_POLICY, () =>
        DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
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
                'hr',
                'h3',
                'h4',
                'a',
                'img',
                'iframe',
                'div',
                'span',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td'
            ],
            ALLOWED_ATTR: [
                'href',
                'src',
                'alt',
                'title',
                'target',
                'rel',
                'width',
                'height',
                'loading',
                'frameborder',
                'scrolling'
            ],
            ALLOW_DATA_ATTR: false,
            ALLOWED_URI_REGEXP: /^https:/i
        })
    );
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

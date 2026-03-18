/**
 * Google Analytics 4 (GA4) 트래킹 서비스
 *
 * gtag.js를 동적으로 로드하고, SPA 네비게이션 시 페이지뷰를 전송합니다.
 * Measurement ID가 없으면 아무 동작도 하지 않습니다.
 */

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

let initialized = false;
const MAX_EVENT_PARAM_LENGTH = 100;
const AUTH_EVENT_COOKIE = 'ga4_auth_event';

type EventParamValue = string | number | boolean | null | undefined;
type EventParams = Record<string, EventParamValue>;

/** gtag.js 스크립트를 동적 로드하고 GA4를 초기화합니다 */
export function initGA4(measurementId: string): void {
    if (initialized || !measurementId || typeof window === 'undefined') return;

    // dataLayer 초기화
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
        // SPA에서는 page_view를 수동 제어해야 초기/전환 페이지뷰 중복을 막을 수 있습니다.
        send_page_view: false
    });

    // gtag.js 스크립트 비동기 로드
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    initialized = true;
}

/** SPA 네비게이션 시 페이지뷰 이벤트를 전송합니다 */
export function trackPageView(path: string): void {
    if (!initialized || typeof window === 'undefined' || !window.gtag) return;
    window.gtag('event', 'page_view', {
        page_path: path
    });
}

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null;
}

function deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function sanitizeEventParams(
    params?: EventParams
): Record<string, string | number | boolean> | undefined {
    if (!params) return undefined;

    const sanitizedEntries: Array<readonly [string, string | number | boolean]> = [];

    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) continue;
            sanitizedEntries.push([key, trimmed.slice(0, MAX_EVENT_PARAM_LENGTH)] as const);
            continue;
        }
        sanitizedEntries.push([key, value] as const);
    }

    return sanitizedEntries.length > 0 ? Object.fromEntries(sanitizedEntries) : undefined;
}

/** 커스텀 이벤트 전송 */
export function trackEvent(name: string, params?: EventParams): void {
    if (!initialized || typeof window === 'undefined' || !window.gtag) return;
    window.gtag('event', name, sanitizeEventParams(params));
}

export function consumePendingAuthEvent(): void {
    if (!initialized || typeof window === 'undefined' || !window.gtag) return;

    const cookieValue = getCookie(AUTH_EVENT_COOKIE);
    if (!cookieValue) return;

    const [eventName, method] = cookieValue.split(':', 2);
    if (
        (eventName !== 'login' && eventName !== 'sign_up') ||
        !method ||
        !/^[a-z0-9_-]+$/i.test(method)
    ) {
        deleteCookie(AUTH_EVENT_COOKIE);
        return;
    }

    trackEvent(eventName, { method });
    deleteCookie(AUTH_EVENT_COOKIE);
}

export function trackPostView(boardId: string, postId: string | number): void {
    trackEvent('post_view', {
        board_id: boardId,
        post_id: String(postId)
    });
}

export function trackSearch(query: string, field: string): void {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    trackEvent('search', {
        search_field: field,
        search_term_length: trimmedQuery.length
    });
}

export function trackFileDownload(
    boardId: string,
    fileName: string,
    fileType: 'attachment' | 'video' = 'attachment'
): void {
    const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;

    trackEvent('file_download', {
        board_id: boardId,
        file_type: fileType,
        file_extension: extension || 'unknown'
    });
}

export function createScrollDepthObserver(
    elements: Iterable<HTMLElement>,
    onDepth: (depth: number) => void
): () => void {
    const firedDepths = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            const rawDepth = (entry.target as HTMLElement).dataset.scrollDepth;
            const depth = rawDepth ? Number(rawDepth) : NaN;
            if (!Number.isFinite(depth) || firedDepths.has(depth)) continue;

            firedDepths.add(depth);
            onDepth(depth);
            observer.unobserve(entry.target);
        }
    });

    for (const element of elements) {
        observer.observe(element);
    }

    return () => observer.disconnect();
}

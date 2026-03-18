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
        send_page_view: true
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

/** 커스텀 이벤트 전송 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
    if (!initialized || typeof window === 'undefined' || !window.gtag) return;
    window.gtag('event', name, params);
}

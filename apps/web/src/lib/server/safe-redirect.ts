const ALLOWED_ABSOLUTE_REDIRECT_HOSTS = new Set([
    'damoang.net',
    'www.damoang.net',
    'ads.damoang.net',
    'ops.damoang.net'
]);

/**
 * 안전한 리다이렉트 URL 검증
 * 기본은 상대 경로만 허용하고, 운영상 필요한 다모앙 도메인 절대 URL만 예외 허용
 */
export function safeRedirectUrl(url: string | null | undefined, fallback = '/'): string {
    if (!url) return fallback;

    // 같은 사이트 상대 경로. `//host`·`/\host` 는 브라우저가 외부 주소로 해석하고,
    // 제어 문자(탭·개행)는 브라우저가 제거한 뒤 해석하므로 함께 차단한다.
    if (url.startsWith('/')) {
        if (url.startsWith('//') || url.startsWith('/\\') || /[\u0000-\u001f\u007f]/.test(url)) {
            return fallback;
        }
        return url;
    }

    try {
        const parsed = new URL(url);
        if (
            (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
            ALLOWED_ABSOLUTE_REDIRECT_HOSTS.has(parsed.hostname)
        ) {
            return parsed.toString();
        }
    } catch {
        return fallback;
    }

    return fallback;
}

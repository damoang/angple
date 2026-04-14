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

    if (url.startsWith('/') && !url.startsWith('//')) {
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

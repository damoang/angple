/**
 * 안전한 리다이렉트 URL 검증
 * Open Redirect 공격 방지: 상대 경로만 허용
 */
export function safeRedirectUrl(url: string | null | undefined, fallback = '/'): string {
    if (!url) return fallback;

    // 상대 경로만 허용 (/ 로 시작, // 로 시작하면 안 됨)
    if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
    }

    return fallback;
}

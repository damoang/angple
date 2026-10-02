/**
 * 없는 주소(404)의 공개 캐시 여부.
 *
 * 봇·옛 주소가 같은 없는 경로를 되풀이해 요청하므로, 정적 자원처럼 생긴 경로의 404 는
 * CDN 에 잠깐 저장해 오리진 부담을 줄인다. 공개 캐시는 누구에게나 같은 응답에만 써야 하므로
 * **비로그인이고 인증 쿠키도 없는 요청**의 404 만 대상으로 한다.
 */

/** 인증에 쓰이는 쿠키 이름(세션 쿠키 이름은 호출부가 더한다) */
export const AUTH_COOKIE_NAMES = ['damoang_jwt', 'access_token', 'refresh_token'] as const;

/** 정적 자원·옛 주소처럼 생긴 경로인가 — 이 모양의 404 만 공개 캐시 후보다 */
export function isCacheableNotFoundPath(pathname: string): boolean {
    return (
        pathname.startsWith('/theme/') ||
        pathname.startsWith('/themes/') ||
        pathname.startsWith('/wp-') ||
        pathname.startsWith('/wordpress/') ||
        pathname.endsWith('.php') ||
        pathname.endsWith('.asp') ||
        pathname.endsWith('.aspx')
    );
}

/** 요청에 인증 쿠키가 하나라도 실려 있는가 */
export function hasAuthCookie(
    getCookie: (name: string) => string | undefined,
    sessionCookieName: string
): boolean {
    if (getCookie(sessionCookieName)) return true;
    return AUTH_COOKIE_NAMES.some((name) => Boolean(getCookie(name)));
}

export function shouldPublicCacheNotFound(input: {
    status: number;
    pathname: string;
    /** 서버가 이 요청의 회원을 확인했는가 */
    hasUser: boolean;
    /** 요청에 인증 쿠키가 실려 있는가(회원 확인에 실패했더라도) */
    hasAuthCookie: boolean;
}): boolean {
    if (input.status !== 404) return false;
    if (input.hasUser || input.hasAuthCookie) return false;
    return isCacheableNotFoundPath(input.pathname);
}

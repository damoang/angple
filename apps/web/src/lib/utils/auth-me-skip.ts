/**
 * 첫 로드 때 `/api/auth/me` 로 로그인 상태를 다시 물어볼지 판정한다.
 *
 * SSR 은 세션 쿠키로 이미 로그인 여부를 알고 있고(`isLoggedIn`), 캐시를 위해 user 를 벗겨도
 * 이 불리언은 남긴다. SSR 이 「비로그인 확정」이라고 말했고, 세션 조회 장애(`authDegraded`)도
 * 아니며, 로그인 사용자에게 발급되는 `user_basic`·`ssr_auth` 쿠키도 없다면 `/api/auth/me` 가
 * 돌려줄 답은 `{ user: null }` 뿐이다. 이 경우에만 요청을 생략한다.
 *
 * 다음 경우는 지금처럼 요청한다(보수적으로):
 * - `isLoggedIn` 이 `false` 가 아님(true·누락 등 SSR 이 모르는 경우)
 * - `authDegraded` 가 true (세션 조회 일시 장애 — 로그아웃 확정이 아님)
 * - `user_basic` 쿠키가 있음(파싱 가능 여부와 무관)
 * - `ssr_auth` 쿠키가 있음(로그인 응답에서 발급 — 캐시된 비로그인 HTML 을 받았을 가능성)
 */
export interface AuthMeFetchInput {
    isLoggedIn: boolean | null | undefined;
    authDegraded: boolean | null | undefined;
    hasUserBasic: boolean;
    hasSsrAuth: boolean;
}

export function shouldFetchAuthMe({
    isLoggedIn,
    authDegraded,
    hasUserBasic,
    hasSsrAuth
}: AuthMeFetchInput): boolean {
    if (isLoggedIn !== false) return true;
    if (authDegraded === true) return true;
    if (hasUserBasic) return true;
    if (hasSsrAuth) return true;
    return false;
}

/**
 * `document.cookie` 문자열에 `user_basic` 쿠키가 있는지(값 유효성과 무관하게) 확인한다.
 */
export function hasUserBasicCookie(cookieString: string | null | undefined): boolean {
    if (!cookieString) return false;
    return /(?:^|;\s*)user_basic=[^;]/.test(cookieString);
}

/**
 * `document.cookie` 문자열에 값이 비어 있지 않은 `ssr_auth` 쿠키가 있는지 확인한다.
 */
export function hasSsrAuthCookie(cookieString: string | null | undefined): boolean {
    if (!cookieString) return false;
    return /(?:^|;\s*)ssr_auth=[^;]/.test(cookieString);
}

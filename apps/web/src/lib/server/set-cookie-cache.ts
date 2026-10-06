/**
 * 쿠키를 내리는 응답의 캐시 제어 (순수 함수 + 적용 헬퍼).
 *
 * 공개 캐시(CDN)는 저장할 때 Set-Cookie 를 떼어 낸다. 쿠키를 내리는 응답이 공개 캐시
 * 대상이 되면, 같은 요청에서 새로 발급한 쿠키가 요청한 본인에게도 전달되지 않는다.
 * 그래서 Set-Cookie 가 하나라도 있는 응답은 어떤 분기에서 정한 값이든 private 으로 바꾼다.
 *
 * ⛔ 판정은 hooks 의 `resolve()` 가 끝난 뒤에 해야 한다. SvelteKit 은 `event.cookies.set` 으로
 *    모은 쿠키를 resolve 래퍼 안에서 응답 헤더(`set-cookie`)로 합친다. 그 뒤에 읽으면
 *    `event.cookies` 로 붙인 쿠키와 핸들러가 직접 붙인 쿠키를 모두 같은 헤더에서 본다.
 */

/** Set-Cookie 가 있는 응답에 강제하는 값 */
export const SET_COOKIE_CACHE_CONTROL = 'private, no-store';

/**
 * Cache-Control 보다 우선하는 CDN 전용 캐시 헤더. 하나라도 남아 있으면 CDN 이
 * Cache-Control 의 private 을 무시하고 저장할 수 있으므로 함께 지운다.
 */
export const CDN_CACHE_HEADERS = [
    'CDN-Cache-Control',
    'Cloudflare-CDN-Cache-Control',
    'Surrogate-Control'
] as const;

/**
 * 최종 Cache-Control 값을 정한다.
 * Set-Cookie 가 없으면 기존 값을 그대로 돌려준다(없으면 null).
 */
export function resolveCacheControlForSetCookie(
    cacheControl: string | null,
    hasSetCookie: boolean
): string | null {
    return hasSetCookie ? SET_COOKIE_CACHE_CONTROL : cacheControl;
}

/** 응답 헤더에 Set-Cookie 가 하나라도 있는가 */
export function hasSetCookieHeader(headers: Headers): boolean {
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie().length > 0;
    }
    return headers.has('set-cookie');
}

/**
 * Set-Cookie 가 있으면 Cache-Control 을 private 으로 강제하고 CDN 전용 캐시 헤더를 지운다.
 * 바꿨으면 true 를 돌려준다. Set-Cookie 가 없으면 헤더를 건드리지 않는다.
 */
export function enforcePrivateOnSetCookie(headers: Headers): boolean {
    const hasSetCookie = hasSetCookieHeader(headers);
    if (!hasSetCookie) return false;
    const next = resolveCacheControlForSetCookie(headers.get('Cache-Control'), hasSetCookie);
    if (next !== null) headers.set('Cache-Control', next);
    for (const name of CDN_CACHE_HEADERS) headers.delete(name);
    return true;
}

/**
 * 프로필 이미지 프록시(/api/members/me/image) 보조 함수
 * - 판정 로직만 담는 순수 함수(외부 의존은 인자로 받는다)
 */

/**
 * 백엔드에 넘길 액세스 토큰을 고른다.
 * 요청 헤더·쿠키에서 찾은 토큰이 없으면 hooks 가 세션으로 확보한 `locals.accessToken` 을 쓴다.
 * (페이지를 오래 열어 둬 클라이언트 토큰이 만료돼도 로그인 상태면 업로드가 가능해야 한다)
 */
export function resolveProxyToken(
    requestToken: string | null | undefined,
    localsToken: string | null | undefined
): string {
    if (requestToken) return requestToken;
    if (localsToken) return localsToken;
    return '';
}

/**
 * 백엔드 응답 본문을 JSON 으로 해석한다. JSON 이 아니면 null.
 */
export function parseBackendBody(text: string): Record<string, unknown> | null {
    if (!text) return null;
    try {
        const parsed: unknown = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/**
 * 백엔드 오류 응답에서 사용자에게 보일 문구를 고른다.
 */
export function backendErrorMessage(
    body: Record<string, unknown> | null,
    fallback: string
): string {
    const message = body?.error ?? body?.message;
    return typeof message === 'string' && message ? message : fallback;
}

/**
 * 회원 캐시를 비운 뒤 DB 기준 최신 회원 정보를 읽는다.
 * 캐시 무효화가 실패해도 조회는 진행한다(best-effort).
 */
export async function loadFreshMember<T>(
    mbId: string,
    deps: {
        invalidate: (mbId: string) => Promise<void>;
        load: (mbId: string) => Promise<T | null>;
    }
): Promise<T | null> {
    try {
        await deps.invalidate(mbId);
    } catch {
        // 캐시 무효화 실패 — 조회는 계속
    }
    return deps.load(mbId);
}

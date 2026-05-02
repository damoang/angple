/**
 * brickang 인증 헬퍼.
 *
 * angple plugin dispatcher 가 `event.locals.user` 에 다모앙 세션 사용자를 주입한다 (giving 패턴).
 * brickang 라우트는 `requireUser(event)` 로 401 처리 + user_id 추출.
 *
 * NOTE: `@sveltejs/kit` 직접 import 금지. plugin-server-loader 의 import.meta.glob
 * (`plugins/**\/server/*.{ts,js}`) 가 server/ 파일을 build 에 포함시키는데,
 * `@sveltejs/kit` 는 plugins/ 트리에서 resolve 되지 않아 Rollup 이 실패한다.
 * 401 응답은 표준 `Response` throw 로 대체 (SvelteKit 이 자동 처리).
 */

interface RequestEventLike {
    locals: { user?: unknown };
}

interface AuthUser {
    userId: number;
    nickname: string;
}

interface LocalsUser {
    mb_no?: number | null;
    id?: number | null;
    mb_id?: string | null;
    mb_nick?: string | null;
    mb_nickname?: string | null;
    nickname?: string | null;
}

function authResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ message }), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

export function requireUser(event: RequestEventLike): AuthUser {
    const u = event.locals.user as LocalsUser | undefined;
    if (!u) throw authResponse(401, 'authentication required');

    const userId = u.mb_no ?? u.id ?? 0;
    if (!userId) throw authResponse(401, 'authentication required (no user id)');

    const nickname = u.mb_nickname ?? u.mb_nick ?? u.nickname ?? u.mb_id ?? 'user';
    return { userId, nickname };
}

/**
 * 로그인 안 한 사용자도 허용 (조회 API 용).
 */
export function getOptionalUser(event: RequestEventLike): AuthUser | null {
    const u = event.locals.user as LocalsUser | undefined;
    if (!u) return null;
    const userId = u.mb_no ?? u.id ?? 0;
    if (!userId) return null;
    const nickname = u.mb_nickname ?? u.mb_nick ?? u.nickname ?? u.mb_id ?? 'user';
    return { userId, nickname };
}

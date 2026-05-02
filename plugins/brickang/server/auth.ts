/**
 * brickang 인증 헬퍼.
 *
 * angple plugin dispatcher 가 `event.locals.user` 에 다모앙 세션 사용자를 주입한다 (giving 패턴).
 * brickang 라우트는 `requireUser(event)` 로 401 처리 + user_id 추출.
 */

import { error, type RequestEvent } from '@sveltejs/kit';

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

export function requireUser(event: RequestEvent): AuthUser {
    const u = event.locals.user as LocalsUser | undefined;
    if (!u) throw error(401, 'authentication required');

    const userId = u.mb_no ?? u.id ?? 0;
    if (!userId) throw error(401, 'authentication required (no user id)');

    const nickname = u.mb_nickname ?? u.mb_nick ?? u.nickname ?? u.mb_id ?? 'user';
    return { userId, nickname };
}

/**
 * 로그인 안 한 사용자도 허용 (조회 API 용).
 */
export function getOptionalUser(event: RequestEvent): AuthUser | null {
    const u = event.locals.user as LocalsUser | undefined;
    if (!u) return null;
    const userId = u.mb_no ?? u.id ?? 0;
    if (!userId) return null;
    const nickname = u.mb_nickname ?? u.mb_nick ?? u.nickname ?? u.mb_id ?? 'user';
    return { userId, nickname };
}

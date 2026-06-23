/**
 * user_basic 쿠키 파싱 + 발행 유틸리티 (Phase A/B/C of split cookie).
 *
 * login 시 base64 JSON 으로 emit된 user_basic 쿠키를 서버사이드에서 파싱/갱신.
 * 프로필 변경(이미지/닉네임/레벨) 시 이 모듈의 issueUserBasicCookie() 로 재발행.
 *
 * 보안:
 * - user_basic은 HttpOnly=false → client JS 접근 허용 (XSS 주의)
 * - **민감 정보(email/accessToken) 제외** — 단순 profile 표시용
 * - 권한 판단은 기존 session 검증에서 수행, 이 쿠키를 신뢰 X
 */

import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

export interface UserBasic {
    id: string;
    /** g5_member 숫자 PK (mb_no). 구쿠키 호환을 위해 optional. */
    mb_no?: number;
    nickname: string;
    mb_level: number;
    as_level: number;
    mb_image: string | null;
    mb_image_updated_at: number | null;
    /**
     * 실명인증 여부(불리언). 클라 fast-path 가 실명인증 게이트(공감·글쓰기)를 정확히
     * 판단하려면 필요(#12789 incident). PII(실명/인증값)는 싣지 않고 여부만 담는다.
     * 구쿠키 호환을 위해 optional — undefined(레거시)면 클라는 fast-path 대신
     * /api/auth/me 로 폴백해 진실을 조회한다(미인증 단정 금지).
     */
    certified?: boolean;
}

/**
 * user_basic 쿠키 값을 UserBasic 객체로 파싱.
 * 유효성/타입 검증 실패 시 null 반환 (fallback: /api/auth/me).
 */
export function parseUserBasicCookie(encoded: string | null | undefined): UserBasic | null {
    if (!encoded) return null;
    try {
        const json = Buffer.from(encoded, 'base64').toString('utf-8');
        const data = JSON.parse(json) as unknown;

        if (!data || typeof data !== 'object') return null;
        const d = data as Record<string, unknown>;

        if (typeof d.id !== 'string' || d.id.length === 0) return null;
        if (typeof d.nickname !== 'string') return null;
        if (typeof d.mb_level !== 'number') return null;
        if (typeof d.as_level !== 'number') return null;

        return {
            id: d.id,
            mb_no: typeof d.mb_no === 'number' ? d.mb_no : undefined,
            nickname: d.nickname,
            mb_level: d.mb_level,
            as_level: d.as_level,
            mb_image: typeof d.mb_image === 'string' ? d.mb_image : null,
            mb_image_updated_at:
                typeof d.mb_image_updated_at === 'number' ? d.mb_image_updated_at : null,
            // 레거시 쿠키는 certified 가 없다 → undefined 유지(클라가 폴백 판단에 사용).
            certified: typeof d.certified === 'boolean' ? d.certified : undefined
        };
    } catch {
        return null;
    }
}

/**
 * user_basic 쿠키 발행.
 *
 * 사용처:
 * - login 직후 (api/auth/login/+server.ts) — 초기 발행
 * - 프로필 변경 API 직후 (image/nickname/level) — stale 방지 재발행
 *
 * Cookie 속성: SameSite=Lax, Secure(!dev), HttpOnly=false, 30d.
 */
const USER_BASIC_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30d

export function issueUserBasicCookie(cookies: Cookies, basic: UserBasic): void {
    const payload = {
        id: basic.id,
        mb_no: basic.mb_no,
        nickname: basic.nickname,
        mb_level: basic.mb_level,
        as_level: basic.as_level,
        mb_image: basic.mb_image,
        mb_image_updated_at: basic.mb_image_updated_at,
        // 실명인증 여부(boolean). undefined(미지정)면 키를 생략해 레거시와 동일 취급.
        ...(typeof basic.certified === 'boolean' ? { certified: basic.certified } : {})
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    const domainOpt = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};
    cookies.set('user_basic', encoded, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: !dev,
        maxAge: USER_BASIC_COOKIE_MAX_AGE,
        ...domainOpt
    });
}

export function clearUserBasicCookie(cookies: Cookies): void {
    const domainOpt = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};
    cookies.delete('user_basic', { path: '/', ...domainOpt });
}

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

/** user_basic 을 만드는 데 필요한 회원 필드(g5_member 행의 부분집합). */
export interface UserBasicMemberSource {
    mb_id: string;
    mb_no?: number;
    mb_nick?: string | null;
    mb_name?: string | null;
    mb_level?: number | null;
    as_level?: number | null;
    mb_certify?: string | null;
    mb_image_url?: string | null;
    mb_image_updated_at?: string | Date | null;
}

/**
 * 이미지 갱신 시각(ISO 문자열 또는 Date)을 Unix 초로 바꾼다. 비었거나 해석할 수 없으면 null.
 */
export function toImageUnixSeconds(value: string | Date | null | undefined): number | null {
    if (!value) return null;
    // NaN(해석 불가)·0 은 null — hooks 가 쓰던 `|| null` 과 같은 규칙
    return Math.floor(new Date(value).getTime() / 1000) || null;
}

/**
 * 회원 행에서 user_basic 쿠키 값을 만든다.
 *
 * ⛔ 쿠키를 발급하는 곳(hooks, 프로필 이미지 프록시)은 모두 이 함수를 써야 한다.
 *    발급처마다 필드가 다르면 hooks 의 비교(`userBasicNeedsReissue`)가 매 요청
 *    「불일치」로 보고 쿠키를 다시 발급한다. 이미지 프록시가 certified 를 빠뜨려
 *    업로드 직후 요청마다 재발급이 강제됐다.
 */
export function buildUserBasicFromMember(member: UserBasicMemberSource): UserBasic {
    return {
        id: member.mb_id,
        mb_no: member.mb_no,
        nickname: member.mb_nick || member.mb_name || '',
        mb_level: member.mb_level ?? 0,
        as_level: member.as_level ?? 0,
        mb_image: member.mb_image_url || null,
        mb_image_updated_at: toImageUnixSeconds(member.mb_image_updated_at),
        // 실명인증 여부 — fast-path 가 공감/글쓰기 게이트를 정확히 판단하려면
        // 쿠키에 반드시 담아야 한다(#12789). PII 없이 boolean 만.
        certified: !!member.mb_certify
    };
}

/**
 * 기존 user_basic 쿠키를 새 값으로 다시 발급해야 하는지 판정한다.
 *
 * ⛔ 쿠키에 담는 값은 전부 여기서 비교해야 한다.
 *    PUBLIC_USER_BASIC_CLIENT_READ=true 면 클라이언트가 /api/auth/me 대신
 *    이 쿠키를 읽으므로(+layout.svelte), 비교에서 빠진 필드는 쿠키 수명
 *    30일 동안 옛 값으로 남는다.
 *    mb_level 이 빠져 있어 승급해도 옛 등급으로 동작했다(#13055):
 *    쿠키는 기기별이라 "폰은 되는데 태블릿은 안 되는" 증상으로 나타났다.
 */
export function userBasicNeedsReissue(existing: UserBasic | null, next: UserBasic): boolean {
    return (
        !existing ||
        existing.id !== next.id ||
        existing.mb_image_updated_at !== next.mb_image_updated_at ||
        existing.certified !== next.certified ||
        existing.mb_level !== next.mb_level ||
        existing.as_level !== next.as_level ||
        existing.nickname !== next.nickname
    );
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

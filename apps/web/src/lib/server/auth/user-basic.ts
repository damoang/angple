/**
 * user_basic 쿠키 파싱 유틸리티 (Phase B of split cookie).
 *
 * login 시 base64 JSON 으로 emit된 user_basic 쿠키를 서버사이드에서 파싱.
 * 이 파일은 **Phase B 스캐폴딩** — 실제 authenticateSSR 통합은 별도 PR에서.
 *
 * 보안:
 * - user_basic은 HttpOnly=false → client JS 접근 허용 (XSS 주의)
 * - **민감 정보(email/accessToken) 제외** — 단순 profile 표시용
 * - 권한 판단은 기존 session 검증에서 수행, 이 쿠키를 신뢰 X
 */

export interface UserBasic {
    id: string;
    nickname: string;
    mb_level: number;
    as_level: number;
    mb_image: string | null;
    mb_image_updated_at: number | null;
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
            nickname: d.nickname,
            mb_level: d.mb_level,
            as_level: d.as_level,
            mb_image: typeof d.mb_image === 'string' ? d.mb_image : null,
            mb_image_updated_at:
                typeof d.mb_image_updated_at === 'number' ? d.mb_image_updated_at : null
        };
    } catch {
        return null;
    }
}

/**
 * user_basic 쿠키 client-side 파서 (Phase C of split cookie).
 *
 * document.cookie에서 user_basic 값을 추출/파싱.
 * base64 decode는 atob() (browser + Node 16+ 모두 동작).
 *
 * 서버 사이드 parser는 `$lib/server/auth/user-basic.ts` 참조 (Buffer 기반).
 */

export interface UserBasic {
    id: string;
    nickname: string;
    mb_level: number;
    as_level: number;
    mb_image: string | null;
    mb_image_updated_at: number | null;
}

function validateUserBasic(data: unknown): UserBasic | null {
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
}

/**
 * base64 encoded JSON 을 UserBasic 으로 파싱.
 */
export function parseUserBasicBase64(encoded: string | null | undefined): UserBasic | null {
    if (!encoded) return null;
    try {
        const json = atob(encoded);
        const data = JSON.parse(json) as unknown;
        return validateUserBasic(data);
    } catch {
        return null;
    }
}

/**
 * document.cookie 문자열에서 user_basic 쿠키를 찾아 파싱.
 * 없으면 null.
 */
export function readUserBasicFromCookie(cookieString: string): UserBasic | null {
    if (!cookieString) return null;
    const match = cookieString.match(/(?:^|;\s*)user_basic=([^;]+)/);
    if (!match) return null;
    return parseUserBasicBase64(decodeURIComponent(match[1]));
}

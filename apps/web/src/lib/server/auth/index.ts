/**
 * 서버 사이드 인증 유틸리티
 *
 * 인증 우선순위:
 *   1. access_token 쿠키 (SvelteKit 소셜로그인 JWT)
 *   2. refresh_token 쿠키 JWT 검증 → DB에서 회원 조회
 *   3. damoang_jwt 쿠키 (레거시 SSO JWT, issuer 무시)
 */
import { verifyToken, verifyTokenLax, type JwtPayload } from './jwt.js';
import { getMemberById } from './oauth/member.js';
import type { Cookies } from '@sveltejs/kit';

export interface AuthUser {
    mb_id: string;
    mb_name: string;
    mb_level: number;
    mb_email: string;
}

/**
 * 쿠키에서 인증 사용자 정보 추출
 */
export async function getAuthUser(cookies: Cookies): Promise<AuthUser | null> {
    // 1순위: access_token 쿠키 (SvelteKit 소셜로그인)
    const accessToken = cookies.get('access_token');
    if (accessToken) {
        const payload = await verifyToken(accessToken);
        if (payload) {
            return {
                mb_id: payload.sub,
                mb_name: payload.nickname,
                mb_level: payload.level,
                mb_email: payload.email
            };
        }
    }

    // 2순위: refresh_token 쿠키 → JWT strict 검증 → DB 회원 조회
    const refreshToken = cookies.get('refresh_token');
    if (refreshToken) {
        try {
            const payload = await verifyToken(refreshToken);
            if (payload?.sub) {
                const member = await getMemberById(payload.sub);
                if (member) {
                    return {
                        mb_id: member.mb_id,
                        mb_name: member.mb_nick || member.mb_name,
                        mb_level: member.mb_level ?? 0,
                        mb_email: member.mb_email || ''
                    };
                }
            }
        } catch {
            // refresh_token 검증 실패 → 다음으로
        }
    }

    // 3순위: damoang_jwt (레거시 PHP SSO) → DAMOANG_JWT_SECRET으로 검증
    // PHP JWT 페이로드에 mb_id, mb_name, mb_level, mb_email이 직접 포함됨
    const legacyJwt = cookies.get('damoang_jwt');
    if (legacyJwt) {
        try {
            const payload = await verifyTokenLax(legacyJwt);
            if (payload?.sub) {
                return {
                    mb_id: payload.sub,
                    mb_name: payload.nickname,
                    mb_level: payload.level,
                    mb_email: payload.email
                };
            }
        } catch {
            // damoang_jwt 검증 실패
        }
    }

    return null;
}

export { verifyToken, generateAccessToken, generateRefreshToken } from './jwt.js';
export type { JwtPayload } from './jwt.js';

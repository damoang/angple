import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import {
    destroySession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME
} from '$lib/server/auth/session-store.js';
import { hashToken, revokeToken } from '$lib/server/auth/token-store.js';
import { clearDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

// 쿠키 도메인: Go 백엔드 cookieDomain()과 일치 (쿠키 충돌 방지)
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '';

/**
 * POST /api/auth/logout
 * 로그아웃 처리: 세션 파괴 + 토큰 폐기 + 쿠키 삭제
 */
export const POST: RequestHandler = async ({ cookies, fetch, locals }) => {
    // 1. 서버사이드 세션 파괴
    const sessionId = cookies.get(SESSION_COOKIE_NAME);
    if (sessionId) {
        try {
            await destroySession(sessionId);
        } catch {
            // 세션 파괴 실패해도 계속 진행
        }
    }

    // 2. Refresh token 폐기 (DB)
    const refreshToken = cookies.get('refresh_token');
    if (refreshToken) {
        try {
            // DB에서 토큰 폐기
            await revokeToken(hashToken(refreshToken));
        } catch {
            // 폐기 실패해도 계속 진행
        }

        // Go 백엔드 로그아웃 호출 (서버 사이드 삭제)
        try {
            await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
                method: 'POST',
                headers: {
                    Cookie: `refresh_token=${refreshToken}`
                }
            });
        } catch {
            // 백엔드 호출 실패해도 로컬 쿠키는 삭제
        }
    }

    // 3. 모든 인증 쿠키 삭제
    const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};
    const cookieOpts = {
        path: '/',
        secure: !dev,
        httpOnly: true,
        ...domainOpt
    } as const;

    // 세션 쿠키
    cookies.delete(SESSION_COOKIE_NAME, cookieOpts);
    cookies.delete(CSRF_COOKIE_NAME, {
        ...cookieOpts,
        httpOnly: false,
        sameSite: 'strict' as const
    });

    // JWT 쿠키 (레거시)
    cookies.delete('refresh_token', cookieOpts);
    cookies.delete('damoang_jwt', { ...cookieOpts, httpOnly: false });
    cookies.delete('access_token', { ...cookieOpts, httpOnly: false });

    // user_basic 쿠키 (SSR/client 공유 프로필, login에서 발행)
    cookies.delete('user_basic', { ...cookieOpts, httpOnly: false });

    // 서브도메인 SSO 쿠키 삭제 (.damoang.net 도메인)
    clearDamoangSSOCookie(cookies);

    return json({ success: true });
};

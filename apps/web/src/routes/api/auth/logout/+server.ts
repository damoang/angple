import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

/**
 * POST /api/auth/logout
 * 로그아웃 처리: Go 백엔드 로그아웃 + 모든 인증 쿠키 삭제
 */
export const POST: RequestHandler = async ({ cookies, fetch }) => {
    // 1. Go 백엔드 로그아웃 호출 (refresh_token 쿠키 서버 사이드 삭제)
    const refreshToken = cookies.get('refresh_token');
    if (refreshToken) {
        try {
            await fetch(`${BACKEND_URL}/api/v2/auth/logout`, {
                method: 'POST',
                headers: {
                    Cookie: `refresh_token=${refreshToken}`
                }
            });
        } catch {
            // 백엔드 호출 실패해도 로컬 쿠키는 삭제
        }
    }

    // 2. 모든 인증 쿠키 삭제
    const cookieOpts = {
        path: '/',
        secure: !dev,
        httpOnly: true
    } as const;

    cookies.delete('refresh_token', cookieOpts);
    cookies.delete('damoang_jwt', { ...cookieOpts, httpOnly: false });
    cookies.delete('access_token', { ...cookieOpts, httpOnly: false });

    return json({ success: true });
};

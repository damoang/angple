import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Admin 레이아웃 서버 로드
 *
 * hooks.server.ts에서 이미 SSR 인증 완료 → event.locals 사용
 * level >= 10 이면 관리자
 */

export const load: LayoutServerLoad = async ({ locals, url }) => {
    // 설치 페이지는 권한 체크 제외
    if (url.pathname.startsWith('/install')) {
        return { isAdmin: false, authChecked: false };
    }

    const isLoginPage = url.pathname === '/admin/login';
    const user = locals.user;

    if (user) {
        const isAdmin = user.level >= 10;

        if (isAdmin) {
            if (isLoginPage) {
                const redirectTo = url.searchParams.get('redirect') || '/admin';
                throw redirect(303, redirectTo);
            }
            return { isAdmin: true, authChecked: true, nickname: user.nickname };
        }

        // 로그인됐지만 관리자 아님
        return {
            isAdmin: false,
            authChecked: true,
            accessDenied: true,
            nickname: user.nickname
        };
    }

    // 개발 모드: VITE_SKIP_AUTH
    const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
    if (skipAuth) {
        if (isLoginPage) throw redirect(303, '/admin');
        return { isAdmin: true, authChecked: true };
    }

    // 로그인 페이지는 그대로 표시
    if (isLoginPage) {
        return { isAdmin: false, authChecked: true };
    }

    // 미인증 → 로그인 페이지로 리다이렉트
    throw redirect(303, `/admin/login?redirect=${encodeURIComponent(url.pathname)}`);
};

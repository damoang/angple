import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Admin 레이아웃 서버 로드
 *
 * 관리자 권한 체크:
 * - 세션 쿠키 또는 로컬 인증으로 관리자 확인
 * - 미인증 시 /admin/login 으로 리다이렉트
 * - /admin/login 페이지는 예외 처리
 */
export const load: LayoutServerLoad = async ({ cookies, url }) => {
    // 로그인 페이지와 설치 페이지는 권한 체크 제외
    if (url.pathname === '/admin/login' || url.pathname.startsWith('/install')) {
        return { isAdmin: false };
    }

    // 세션 쿠키에서 인증 상태 확인
    const sessionToken = cookies.get('admin_session');

    if (!sessionToken) {
        // 개발 모드: VITE_SKIP_AUTH 환경변수가 있으면 인증 건너뛰기
        const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
        if (skipAuth) {
            return { isAdmin: true };
        }

        throw redirect(303, `/admin/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    // TODO: 실제 세션 토큰 검증 (백엔드 API 연동 시)
    // const user = await validateSession(sessionToken);
    // if (!user || user.mb_level < 10) {
    //     cookies.delete('admin_session', { path: '/' });
    //     throw redirect(303, '/admin/login');
    // }

    return {
        isAdmin: true
    };
};

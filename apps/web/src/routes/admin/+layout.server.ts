import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Admin 레이아웃 서버 로드
 *
 * 인증 우선순위:
 * 1. admin_session 쿠키 (관리자 전용 세션)
 * 2. damoang_jwt / access_token 쿠키 (웹 로그인 SSO)
 * 3. VITE_SKIP_AUTH 환경변수 (개발 모드)
 *
 * - 이미 웹에서 관리자로 로그인되어 있으면 로그인 페이지 건너뜀
 * - 로그인되어 있지만 관리자가 아니면 접근 제한 메시지
 * - 미인증 시 /admin/login 으로 리다이렉트
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8081';

/** 백엔드 API로 사용자 프로필 조회 */
async function fetchUserProfile(
    token: string
): Promise<{ isAdmin: boolean; nickname?: string } | null> {
    try {
        const res = await fetch(`${BACKEND_API_URL}/api/v2/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        const level = data?.data?.level ?? data?.level ?? 0;
        return {
            isAdmin: level >= 10,
            nickname: data?.data?.nickname ?? data?.nickname
        };
    } catch {
        return null;
    }
}

/** 쿠키에서 인증 토큰 추출 */
function getAuthToken(cookies: { get(name: string): string | undefined }): string | null {
    return (
        cookies.get('admin_session') ||
        cookies.get('damoang_jwt') ||
        cookies.get('access_token') ||
        null
    );
}

export const load: LayoutServerLoad = async ({ cookies, url }) => {
    // 설치 페이지는 권한 체크 제외
    if (url.pathname.startsWith('/install')) {
        return { isAdmin: false, authChecked: false };
    }

    const token = getAuthToken(cookies);
    const isLoginPage = url.pathname === '/admin/login';

    // 토큰이 있으면 백엔드로 검증
    if (token) {
        const profile = await fetchUserProfile(token);

        if (profile?.isAdmin) {
            // 관리자 확인 → 로그인 페이지면 대시보드로 리다이렉트
            if (isLoginPage) {
                const redirectTo = url.searchParams.get('redirect') || '/admin';
                throw redirect(303, redirectTo);
            }
            return { isAdmin: true, authChecked: true, nickname: profile.nickname };
        }

        if (profile && !profile.isAdmin) {
            // 로그인은 됐지만 관리자가 아님 → 접근 제한
            return {
                isAdmin: false,
                authChecked: true,
                accessDenied: true,
                nickname: profile.nickname
            };
        }
    }

    // 개발 모드: VITE_SKIP_AUTH 환경변수가 있으면 인증 건너뛰기
    const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
    if (skipAuth) {
        if (isLoginPage) {
            throw redirect(303, '/admin');
        }
        return { isAdmin: true, authChecked: true };
    }

    // 로그인 페이지는 그대로 표시
    if (isLoginPage) {
        return { isAdmin: false, authChecked: true };
    }

    // 미인증 → 로그인 페이지로 리다이렉트
    throw redirect(303, `/admin/login?redirect=${encodeURIComponent(url.pathname)}`);
};

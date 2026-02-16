/**
 * 인증 상태 관리 (Svelte 5 Runes)
 * JWT 쿠키 기반 인증 + 레거시 SSO 지원
 */

import { apiClient } from '$lib/api';
import type { DamoangUser } from '$lib/api/types.js';

// 인증 상태
let user = $state<DamoangUser | null>(null);
let isLoading = $state(true);
let error = $state<string | null>(null);

// Derived states
const isLoggedIn = $derived(user !== null);

/**
 * 현재 사용자 정보 가져오기
 * 쿠키 기반 서버 인증 정보 조회
 */
async function fetchCurrentUser(): Promise<void> {
    isLoading = true;
    error = null;

    try {
        user = await apiClient.getCurrentUser();
    } catch (err) {
        console.error('Failed to fetch current user:', err);
        error = err instanceof Error ? err.message : 'Unknown error';
        user = null;
    } finally {
        isLoading = false;
    }
}

/**
 * SSR에서 받은 인증 데이터로 초기화
 * hooks.server.ts에서 설정한 user/accessToken을 +layout.server.ts 경유로 받음
 */
function initFromSSR(ssrUser: { nickname: string; level: number }, accessToken: string): void {
    user = {
        mb_id: '',
        mb_name: ssrUser.nickname,
        mb_level: ssrUser.level,
        mb_email: ''
    };
    apiClient.setAccessToken(accessToken);
    isLoading = false;
    // 클라이언트에서 최신 정보로 갱신 (비동기)
    apiClient.tryRefreshToken().then(() => fetchCurrentUser());
}

/**
 * 인증 상태 초기화
 * 앱 시작 시 호출 — refreshToken 쿠키로 accessToken 자동 갱신
 */
async function initAuth(): Promise<void> {
    // 레거시 localStorage 토큰 정리
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('access_token');
    }

    // 소셜로그인 후 access_token 쿠키가 있으면 메모리로 이동
    if (typeof document !== 'undefined') {
        const atCookie = document.cookie.split('; ').find((r) => r.startsWith('access_token='));
        if (atCookie) {
            const token = atCookie.split('=')[1];
            if (token) {
                apiClient.setAccessToken(token);
            }
        }
        // 쿠키 정리 (메모리로 이동 완료)
        document.cookie = 'access_token=; path=/; max-age=0';
    }

    // refreshToken 쿠키로 accessToken 자동 갱신
    await apiClient.tryRefreshToken();
    await fetchCurrentUser();
}

/**
 * 인증 상태 리셋
 * 로그아웃 후 호출
 */
function resetAuth(): void {
    user = null;
    error = null;
    apiClient.setAccessToken(null);
}

/**
 * 로그인 페이지로 이동
 */
function redirectToLogin(): void {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
}

/**
 * 로그아웃 처리
 */
async function logout(): Promise<void> {
    try {
        await apiClient.logoutUser();
    } finally {
        resetAuth();
        window.location.href = '/';
    }
}

/**
 * @deprecated 이전 버전 호환성을 위해 유지
 */
function redirectToLogout(): void {
    logout();
}

// Export getters for reactive access
export function getUser() {
    return user;
}

export function getIsLoggedIn() {
    return isLoggedIn;
}

export function getIsLoading() {
    return isLoading;
}

export function getError() {
    return error;
}

// Export actions
export const authActions = {
    initAuth,
    initFromSSR,
    fetchCurrentUser,
    resetAuth,
    redirectToLogin,
    redirectToLogout,
    logout
};

// Export authStore for theme compatibility
export const authStore = {
    get user() {
        return user;
    },
    get isAuthenticated() {
        return isLoggedIn;
    },
    get isLoading() {
        return isLoading;
    },
    get error() {
        return error;
    },
    ...authActions
};

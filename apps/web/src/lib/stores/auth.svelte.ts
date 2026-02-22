/**
 * 인증 상태 관리 (Svelte 5 Runes)
 *
 * 서버사이드 세션 기반 인증:
 * - SSR에서 세션 검증 후 사용자 정보를 PageData로 전달
 * - 클라이언트는 토큰 관리 불필요 (서버가 세션 쿠키로 처리)
 * - CSRF 토큰은 PageData에서 받아 API 요청 헤더에 포함
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
    } catch {
        // 인증 실패 시 SSR에서 설정된 사용자 정보 유지
        if (!user) {
            user = null;
        }
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
}

/**
 * 인증 상태 초기화
 * 앱 시작 시 호출 — 세션 쿠키로 자동 인증 (토큰 관리 불필요)
 */
async function initAuth(): Promise<void> {
    // 레거시 localStorage 토큰 정리
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('access_token');
    }

    // 레거시: 소셜로그인 후 access_token 쿠키 정리 (더 이상 사용 안 함)
    if (typeof document !== 'undefined') {
        document.cookie = 'access_token=; path=/; max-age=0';
    }

    // 세션 기반 인증: 서버가 쿠키로 인증하므로 클라이언트 토큰 갱신 불필요
    // SSR에서 이미 사용자 정보가 설정되어 있으면 추가 API 호출 생략
    if (!user) {
        await apiClient.tryRefreshToken();
        await fetchCurrentUser();
    }
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

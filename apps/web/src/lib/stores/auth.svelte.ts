/**
 * 인증 상태 관리 (Svelte 5 Runes)
 * damoang.net JWT 쿠키 기반 SSO 인증
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
 * damoang_jwt 쿠키를 사용하여 서버에서 인증 정보 조회
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
 * 인증 상태 초기화
 * 앱 시작 시 호출
 */
async function initAuth(): Promise<void> {
    // localStorage 토큰이 있지만 쿠키에 없으면 동기화 (SSR에서 읽을 수 있도록)
    syncTokenToCookie();
    await fetchCurrentUser();
}

/** localStorage의 access_token을 쿠키로 동기화 */
function syncTokenToCookie(): void {
    if (typeof document === 'undefined') return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const hasCookie = document.cookie.split('; ').some((c) => c.startsWith('access_token='));
    if (!hasCookie) {
        document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    }
}

/**
 * 인증 상태 리셋
 * 로그아웃 후 호출
 */
function resetAuth(): void {
    user = null;
    error = null;
    // 쿠키 토큰도 제거
    if (typeof document !== 'undefined') {
        document.cookie = 'access_token=; path=/; max-age=0';
    }
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

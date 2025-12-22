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
    await fetchCurrentUser();
}

/**
 * 인증 상태 리셋
 * 로그아웃 후 호출
 */
function resetAuth(): void {
    user = null;
    error = null;
}

/**
 * damoang.net 로그인 페이지로 이동
 */
function redirectToLogin(): void {
    const currentUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://damoang.net/bbs/login.php?url=${currentUrl}`;
}

/**
 * damoang.net 로그아웃 후 현재 페이지로 복귀
 */
function redirectToLogout(): void {
    const currentUrl = encodeURIComponent(window.location.origin);
    window.location.href = `https://damoang.net/bbs/logout.php?url=${currentUrl}`;
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
    redirectToLogout
};

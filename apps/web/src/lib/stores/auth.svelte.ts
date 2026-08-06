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
function initFromSSR(
    ssrUser: {
        id?: string;
        nickname: string;
        level: number;
        as_level?: number;
        mb_certify?: string;
        mb_image?: string;
        mb_image_updated_at?: string;
        advertiser_end_date?: string;
        advertiser_status?: 'ongoing' | 'expired' | 'scheduled' | 'inactive';
    },
    accessToken: string
): void {
    const mbId = ssrUser.id ?? '';
    // 동일 사용자면 이미지만 갱신 (SPA 네비게이션마다 불필요한 상태 갱신 방지)
    if (user && user.mb_id === mbId) {
        if (ssrUser.mb_image && user.mb_image !== ssrUser.mb_image) {
            user.mb_image = ssrUser.mb_image;
            user.mb_image_updated_at = ssrUser.mb_image_updated_at;
        }
        // 레벨 변경 동기화 (승급 감지를 위해)
        if (ssrUser.level !== user.mb_level) {
            user.mb_level = ssrUser.level;
        }
        // XP 레벨 변경 동기화
        if (ssrUser.as_level !== undefined && ssrUser.as_level !== user.as_level) {
            user.as_level = ssrUser.as_level;
        }
        user.advertiser_end_date = ssrUser.advertiser_end_date;
        user.advertiser_status = ssrUser.advertiser_status;
        isLoading = false;
        return;
    }
    user = {
        mb_id: mbId,
        mb_name: ssrUser.nickname,
        mb_level: ssrUser.level,
        as_level: ssrUser.as_level,
        mb_email: '',
        mb_certify: ssrUser.mb_certify || '',
        mb_image: ssrUser.mb_image,
        mb_image_updated_at: ssrUser.mb_image_updated_at,
        advertiser_end_date: ssrUser.advertiser_end_date,
        advertiser_status: ssrUser.advertiser_status
    };
    apiClient.setAccessToken(accessToken);
    isLoading = false;
}

/**
 * 클라이언트에 액세스 토큰을 확보한다. 이미 있으면 그대로 돌려준다.
 *
 * ⚠️ 로그인 상태인데 토큰이 비어 있는 정상 경로가 존재한다.
 * `SSR_STRIP_USER=true` 면 레이아웃 SSR 이 user·accessToken 을 모두 떼어내고,
 * `PUBLIC_USER_BASIC_CLIENT_READ=true` 면 클라이언트가 user_basic 쿠키로
 * **로그인 상태만** 복원한 뒤 `/api/auth/me` 를 건너뛴다(성능 목적).
 * 쿠키에는 토큰이 없으므로 결과적으로 토큰만 빈 상태가 된다.
 *
 * 평소에는 문제가 되지 않는다 — 화면이 쓰는 API 는 전부 SvelteKit 라우트를
 * 거쳐 httpOnly 세션 쿠키로 인증되기 때문이다. 그러나 브라우저 WebSocket 은
 * 헤더를 붙일 수 없어 토큰을 쿼리로 넘겨야 한다. 그런 기능만 이 함수로
 * 필요한 순간에 토큰을 받아 온다(레이아웃의 fast-path 는 건드리지 않는다).
 */
async function ensureAccessToken(): Promise<string | null> {
    const existing = apiClient.getAccessToken?.() ?? null;
    if (existing) return existing;
    try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!res.ok) return null;
        const me = await res.json();
        if (me?.accessToken) {
            apiClient.setAccessToken(me.accessToken);
            return me.accessToken;
        }
    } catch {
        // 네트워크 실패 — 호출부가 사용자에게 알린다
    }
    return null;
}

/**
 * 인증 상태 초기화
 * 앱 시작 시 호출 — 세션 기반: SSR이 인증 권위, 클라이언트 추가 인증 없음
 */
async function initAuth(): Promise<void> {
    // 레거시 localStorage 토큰 정리
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('access_token');
    }

    // 레거시 쿠키 정리
    if (typeof document !== 'undefined') {
        document.cookie = 'access_token=; path=/; max-age=0';
    }

    // 세션 기반: SSR에서 세션 없음 = 비로그인 확정
    // 클라이언트에서 Go 백엔드에 추가 인증 시도하지 않음
    isLoading = false;
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
    ensureAccessToken,
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
    /** Access token (서버에서 관리, 클라이언트에서는 apiClient 내부 저장) */
    get accessToken(): string | null {
        return apiClient.getAccessToken?.() ?? null;
    },
    ...authActions
};

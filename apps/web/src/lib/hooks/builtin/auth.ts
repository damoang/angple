/**
 * 인증 Built-in Hook
 * 로그인/로그아웃 이벤트, OAuth 프로바이더 관리
 */
import { hooks } from '@angple/hook-system';

/**
 * 인증 Hook 초기화
 * 앱 시작 시 자동으로 등록되는 인증 관련 훅
 */
export function initAuthHooks(): void {
    // 로그인 액션 (priority: 10)
    hooks.addAction('user_login', onUserLogin, 10);

    // 로그아웃 액션 (priority: 10)
    hooks.addAction('user_logout', onUserLogout, 10);

    // 기본 OAuth 프로바이더 등록 (priority: 10)
    hooks.addFilter('auth_providers', registerDefaultProviders, 10);

    console.log('[Built-in] Auth hooks initialized');
}

/**
 * 사용자 로그인 시 실행
 * 로깅, 세션 초기화 등 수행
 */
async function onUserLogin(user: { id: string; provider?: string }): Promise<void> {
    console.log(`[Auth] User logged in: ${user.id} via ${user.provider || 'local'}`);

    // TODO: 실제 구현 시 추가 작업
    // - 마지막 로그인 시간 업데이트
    // - 로그인 로그 저장
    // - 세션 초기화
}

/**
 * 사용자 로그아웃 시 실행
 * 세션 정리 등 수행
 */
async function onUserLogout(userId: string): Promise<void> {
    console.log(`[Auth] User logged out: ${userId}`);

    // TODO: 실제 구현 시 추가 작업
    // - 세션 삭제
    // - 토큰 무효화
}

/**
 * 기본 OAuth 프로바이더 등록
 * 한국 시장에 최적화된 프로바이더 목록
 */
function registerDefaultProviders(providers: string[]): string[] {
    const defaultProviders = ['google', 'kakao', 'naver', 'apple', 'facebook', 'twitter', 'payco'];

    // 기존 프로바이더와 중복 제거하여 병합
    const merged = [...new Set([...providers, ...defaultProviders])];

    return merged;
}

/**
 * GitHub 설치 인증 CSRF State 관리
 *
 * 소셜 로그인의 oauth/state.ts 패턴을 재사용하되,
 * 설치용 추가 데이터(scope, themeId)를 포함합니다.
 */

import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

const STATE_COOKIE_NAME = 'github_install_state';
const STATE_MAX_AGE = 600; // 10분

/**
 * GitHub 설치 인증 state 데이터
 */
export interface GitHubInstallStateData {
    /** CSRF state 토큰 */
    state: string;
    /** GitHub token 저장용 scope (예: "@damoang") */
    scope: string;
    /** 설치할 테마 ID */
    themeId: string;
    /** 인증 완료 후 리다이렉트 URL */
    redirect: string;
    /** 생성 시각 (ms) */
    timestamp: number;
}

function generateRandomState(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * GitHub 설치 인증 state 생성 및 쿠키 저장
 */
export function createGitHubInstallState(
    cookies: Cookies,
    scope: string,
    themeId: string,
    redirectUrl: string
): string {
    const state = generateRandomState();

    const data: GitHubInstallStateData = {
        state,
        scope,
        themeId,
        redirect: redirectUrl,
        timestamp: Date.now()
    };

    cookies.set(STATE_COOKIE_NAME, JSON.stringify(data), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: !dev,
        maxAge: STATE_MAX_AGE
    });

    return state;
}

/**
 * GitHub 설치 인증 state 검증
 *
 * 검증 성공 시 쿠키를 삭제하고 state 데이터를 반환합니다.
 */
export function validateGitHubInstallState(
    cookies: Cookies,
    state: string
): GitHubInstallStateData | null {
    const raw = cookies.get(STATE_COOKIE_NAME);
    if (!raw) return null;

    try {
        const data: GitHubInstallStateData = JSON.parse(raw);

        if (data.state !== state) return null;
        if (Date.now() - data.timestamp > STATE_MAX_AGE * 1000) return null;

        cookies.delete(STATE_COOKIE_NAME, { path: '/' });
        return data;
    } catch {
        return null;
    }
}

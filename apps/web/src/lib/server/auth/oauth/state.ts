/**
 * OAuth CSRF State 관리
 * httpOnly 쿠키에 state 저장하여 CSRF 공격 방지
 */
import type { Cookies } from '@sveltejs/kit';
import type { OAuthStateData, SocialProvider } from './types.js';
import { dev } from '$app/environment';

const STATE_COOKIE_NAME = 'oauth_state';
const STATE_MAX_AGE = 600; // 10분

function generateRandomState(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createOAuthState(
    cookies: Cookies,
    provider: SocialProvider,
    redirectUrl: string
): string {
    const state = generateRandomState();

    const data: OAuthStateData = {
        state,
        provider,
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

export function validateOAuthState(cookies: Cookies, state: string): OAuthStateData | null {
    const raw = cookies.get(STATE_COOKIE_NAME);
    if (!raw) return null;

    try {
        const data: OAuthStateData = JSON.parse(raw);

        // state 문자열 비교
        if (data.state !== state) return null;

        // 만료 확인 (10분)
        if (Date.now() - data.timestamp > STATE_MAX_AGE * 1000) return null;

        // 검증 성공 후 쿠키 삭제
        cookies.delete(STATE_COOKIE_NAME, { path: '/' });

        return data;
    } catch {
        return null;
    }
}

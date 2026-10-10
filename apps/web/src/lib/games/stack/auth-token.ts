/**
 * 앙쌓기 서버(stack-ws) 요청용 접근 토큰 — 오목·장기 대전과 같은 방식(authActions.ensureAccessToken).
 *
 * fresh=true 면 캐시된 토큰을 쓰지 않고 /api/auth/me 에서 새로 받는다
 * (접근 토큰 수명이 짧아 긴 판이 끝날 무렵이면 만료됐을 수 있다).
 */
import { authActions } from '$lib/stores/auth.svelte.js';

export async function getStackToken(fresh = false): Promise<string | null> {
    if (!fresh) return authActions.ensureAccessToken();
    try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!res.ok) return null;
        const me = await res.json();
        return typeof me?.accessToken === 'string' && me.accessToken ? me.accessToken : null;
    } catch {
        return null;
    }
}

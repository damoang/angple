/**
 * OAuth 시작 라우트
 * GET /auth/start?provider=naver&redirect=/free
 *
 * 1. provider 검증
 * 2. CSRF state 생성 + 쿠키 저장
 * 3. 프로바이더 인가 URL로 302 리다이렉트
 */
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { isValidProvider, getProvider } from '$lib/server/auth/oauth/provider-registry.js';
import { resolveOrigin } from '$lib/server/auth/oauth/config.js';
import { createOAuthState } from '$lib/server/auth/oauth/state.js';
import type { SocialProvider } from '$lib/server/auth/oauth/types.js';
import { TwitterProvider } from '$lib/server/auth/oauth/providers/twitter.js';

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

export const GET: RequestHandler = async ({ url, cookies, request }) => {
    const providerParam = url.searchParams.get('provider');
    const redirectUrl = url.searchParams.get('redirect') || '/';

    if (!providerParam || !isValidProvider(providerParam)) {
        return new Response('지원하지 않는 로그인 방식입니다', { status: 400 });
    }

    const providerName = providerParam.toLowerCase() as SocialProvider;

    try {
        const origin = resolveOrigin(request);
        const provider = await getProvider(providerName, origin);
        const state = createOAuthState(cookies, providerName, redirectUrl);

        // Twitter는 PKCE 사용
        if (provider instanceof TwitterProvider) {
            const { url: authUrl, codeVerifier } =
                await provider.getAuthorizationUrlWithPKCE(state);
            cookies.set('oauth_pkce', codeVerifier, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: url.protocol === 'https:',
                maxAge: 600,
                ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN })
            });
            redirect(302, authUrl);
        }

        const authUrl = provider.getAuthorizationUrl(state);
        redirect(302, authUrl);
    } catch (err) {
        // SvelteKit redirect는 Redirect 에러를 throw하므로 다시 throw
        if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
            throw err;
        }
        console.error('[OAuth Start]', err);
        return new Response('소셜로그인 처리 중 오류가 발생했습니다', { status: 500 });
    }
};

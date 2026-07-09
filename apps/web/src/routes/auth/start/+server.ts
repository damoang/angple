/**
 * OAuth 시작 라우트
 * GET /auth/start?provider=naver&redirect=/free
 *
 * 1. provider 검증
 * 2. CSRF state 생성 + 쿠키 저장
 * 3. 프로바이더 인가 URL로 302 리다이렉트
 */
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isValidProvider, getProvider } from '$lib/server/auth/oauth/provider-registry.js';
import { resolveOrigin } from '$lib/server/auth/oauth/config.js';
import { createOAuthState } from '$lib/server/auth/oauth/state.js';
import type { SocialProvider } from '$lib/server/auth/oauth/types.js';
import { TwitterProvider } from '$lib/server/auth/oauth/providers/twitter.js';

const COOKIE_DOMAIN = env.COOKIE_DOMAIN || undefined;

export const GET: RequestHandler = async ({ url, cookies, request, locals }) => {
    const providerParam = url.searchParams.get('provider');
    const redirectUrl = url.searchParams.get('redirect') || '/';
    // 추가 연결(link) 모드 — 쿼리 파라미터는 단순 플래그이며,
    // 실제 연결 대상 mb_id 는 서버 세션에서만 결정한다 (#12037).
    const isLinkMode = url.searchParams.get('link') === '1';
    // 네이티브 앱 로그인 모드 — 콜백 성공 시 앱 스킴으로 단명 코드 전달
    const isAppMode = url.searchParams.get('app') === '1';

    if (!providerParam || !isValidProvider(providerParam)) {
        return new Response('지원하지 않는 로그인 방식입니다', { status: 400 });
    }

    // link=1 인데 비로그인이면 차단. 클라이언트가 임의 linkTo 를 박아도 무시된다.
    let linkTo: string | undefined;
    if (isLinkMode) {
        const sessionMbId = locals.user?.id;
        if (!sessionMbId) {
            return new Response('로그인이 필요합니다', { status: 401 });
        }
        linkTo = sessionMbId;
    }

    const providerName = providerParam.toLowerCase() as SocialProvider;

    try {
        const origin = resolveOrigin(request);
        const provider = await getProvider(providerName, origin);
        const state = createOAuthState(cookies, providerName, redirectUrl, linkTo, isAppMode);

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

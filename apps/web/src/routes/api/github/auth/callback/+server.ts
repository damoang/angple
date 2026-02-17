/**
 * GitHub OAuth 콜백 라우트
 *
 * GET /api/github/auth/callback?code=X&state=Y
 *
 * 1. CSRF state 검증
 * 2. code → access_token 교환
 * 3. 토큰 저장 (기존 암호화된 token-store 재사용)
 * 4. 마켓플레이스로 리다이렉트 (?autoInstall=themeId)
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { exchangeGitHubCode, validateGitHubInstallState } from '$lib/server/github-oauth';
import { getTokenProvider } from '$lib/server/github-tokens/token-provider';

export const GET: RequestHandler = async ({ url, cookies }) => {
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // GitHub이 에러를 반환한 경우 (사용자가 취소 등)
    if (error) {
        const desc = url.searchParams.get('error_description') || error;
        redirect(302, `/admin/themes/marketplace?error=${encodeURIComponent(desc)}`);
    }

    if (!code || !stateParam) {
        redirect(302, '/admin/themes/marketplace?error=missing_params');
    }

    // 1. CSRF state 검증
    const stateData = validateGitHubInstallState(cookies, stateParam);
    if (!stateData) {
        redirect(302, '/admin/themes/marketplace?error=invalid_state');
    }

    try {
        // 2. code → access_token 교환
        const callbackUrl = `${url.origin}/api/github/auth/callback`;
        const tokenResponse = await exchangeGitHubCode(code, callbackUrl);

        // 3. repo scope 확인
        if (!tokenResponse.scope.includes('repo')) {
            redirect(
                302,
                `/admin/themes/marketplace?error=${encodeURIComponent('repo 권한이 필요합니다. 다시 시도해주세요.')}`
            );
        }

        // 4. 기존 암호화된 token-store에 저장
        const tokenProvider = getTokenProvider();
        await tokenProvider.setToken(stateData.scope, tokenResponse.access_token);

        // 5. 마켓플레이스로 리다이렉트 (autoInstall 파라미터로 자동 설치 트리거)
        const redirectUrl = new URL(stateData.redirect, url.origin);
        redirectUrl.searchParams.set('autoInstall', stateData.themeId);
        redirect(302, redirectUrl.pathname + redirectUrl.search);
    } catch (err) {
        // SvelteKit redirect는 throw하므로 다시 throw
        if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
            throw err;
        }
        console.error('[GitHub OAuth Callback]', err);
        redirect(
            302,
            `/admin/themes/marketplace?error=${encodeURIComponent('GitHub 인증 처리 중 오류가 발생했습니다.')}`
        );
    }
};

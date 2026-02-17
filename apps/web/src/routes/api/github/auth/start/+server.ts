/**
 * GitHub OAuth 시작 라우트
 *
 * GET /api/github/auth/start?scope=@damoang&themeId=damoang-default&redirect=/admin/themes/marketplace
 *
 * 1. 파라미터 검증
 * 2. CSRF state 생성 + 쿠키 저장
 * 3. GitHub OAuth 인가 URL로 302 리다이렉트
 */

import { redirect, json, type RequestHandler } from '@sveltejs/kit';
import {
    isGitHubOAuthConfigured,
    getGitHubAuthorizationUrl,
    createGitHubInstallState
} from '$lib/server/github-oauth';

export const GET: RequestHandler = async ({ url, cookies }) => {
    const scope = url.searchParams.get('scope');
    const themeId = url.searchParams.get('themeId');
    const redirectUrl = url.searchParams.get('redirect') || '/admin/themes/marketplace';

    if (!scope || !themeId) {
        return json(
            { error: 'scope와 themeId 파라미터가 필요합니다.' },
            { status: 400 }
        );
    }

    if (!isGitHubOAuthConfigured()) {
        return json(
            { error: 'GitHub OAuth가 설정되지 않았습니다. GITHUB_CLIENT_ID와 GITHUB_CLIENT_SECRET을 확인하세요.' },
            { status: 500 }
        );
    }

    try {
        const origin = url.origin;
        const callbackUrl = `${origin}/api/github/auth/callback`;
        const state = createGitHubInstallState(cookies, scope, themeId, redirectUrl);
        const authUrl = getGitHubAuthorizationUrl(callbackUrl, state);

        redirect(302, authUrl);
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
            throw err;
        }
        console.error('[GitHub OAuth Start]', err);
        return json(
            { error: 'GitHub OAuth 시작 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
};

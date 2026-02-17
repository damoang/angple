/**
 * GitHub OAuth App 인증 모듈
 *
 * 프리미엄 테마/플러그인 설치를 위한 GitHub OAuth 인증을 처리합니다.
 * 소셜 로그인(BaseOAuthProvider)과 분리된 독립 모듈입니다.
 */

import { env } from '$env/dynamic/private';

export interface GitHubOAuthConfig {
    clientId: string;
    clientSecret: string;
}

/**
 * GitHub OAuth 설정 가져오기
 */
export function getGitHubOAuthConfig(): GitHubOAuthConfig {
    const clientId = env.GITHUB_CLIENT_ID;
    const clientSecret = env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            'GITHUB_CLIENT_ID와 GITHUB_CLIENT_SECRET 환경변수가 설정되지 않았습니다.'
        );
    }

    return { clientId, clientSecret };
}

/**
 * GitHub OAuth가 설정되어 있는지 확인
 */
export function isGitHubOAuthConfigured(): boolean {
    return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

/**
 * GitHub OAuth 인가 URL 생성
 *
 * scope: 'repo' — private 저장소 접근 권한
 */
export function getGitHubAuthorizationUrl(callbackUrl: string, state: string): string {
    const config = getGitHubOAuthConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: callbackUrl,
        scope: 'repo',
        state,
        allow_signup: 'false'
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * GitHub OAuth code → access_token 교환
 *
 * 주의: GitHub token endpoint는 기본적으로 application/x-www-form-urlencoded를 반환합니다.
 * Accept: application/json 헤더를 반드시 포함해야 JSON 응답을 받을 수 있습니다.
 */
export async function exchangeGitHubCode(
    code: string,
    callbackUrl: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
    const config = getGitHubOAuthConfig();

    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: callbackUrl
        })
    });

    if (!response.ok) {
        throw new Error(`GitHub 토큰 교환 실패: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`GitHub OAuth 오류: ${data.error_description || data.error}`);
    }

    return data;
}

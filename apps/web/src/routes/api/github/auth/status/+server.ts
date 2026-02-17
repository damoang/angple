/**
 * GitHub OAuth 설정 상태 확인
 *
 * GET /api/github/auth/status
 *
 * 클라이언트에서 OAuth가 설정되어 있는지 확인하여
 * OAuth 리다이렉트 또는 PAT 다이얼로그 중 선택합니다.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { isGitHubOAuthConfigured } from '$lib/server/github-oauth';

export const GET: RequestHandler = async () => {
    return json({ configured: isGitHubOAuthConfigured() });
};

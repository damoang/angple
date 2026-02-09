/**
 * OAuth 콜백 라우트
 * PHP 콜백 URL 호환: GET /plugin/social/?hauth.done=Naver&code=xxx&state=yyy
 * Apple: POST /plugin/social/?hauth.done=Apple (response_mode=form_post)
 */
import { redirect, error as httpError, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { normalizeProviderName, getProvider } from '$lib/server/auth/oauth/provider-registry.js';
import { validateOAuthState } from '$lib/server/auth/oauth/state.js';
import { findSocialProfile, upsertSocialProfile } from '$lib/server/auth/oauth/social-profile.js';
import {
    getMemberById,
    findMemberByEmail,
    updateLoginTimestamp,
    isMemberActive
} from '$lib/server/auth/oauth/member.js';
import { generateAccessToken, generateRefreshToken } from '$lib/server/auth/jwt.js';
import { AppleProvider } from '$lib/server/auth/oauth/providers/apple.js';
import { TwitterProvider } from '$lib/server/auth/oauth/providers/twitter.js';
import type { OAuthUserProfile } from '$lib/server/auth/oauth/types.js';

/** 공통 콜백 처리 로직 */
async function handleCallback(
    url: URL,
    cookies: Parameters<RequestHandler>[0]['cookies'],
    code: string,
    stateParam: string,
    clientIp: string
): Promise<never> {
    // 1. hauth.done 파라미터에서 프로바이더 추출
    const hauthDone = url.searchParams.get('hauth.done');
    if (!hauthDone) {
        redirect(302, '/login?error=invalid_provider');
    }

    const providerName = normalizeProviderName(hauthDone);
    if (!providerName) {
        redirect(302, '/login?error=invalid_provider');
    }

    // 2. state 검증 (CSRF)
    const stateData = validateOAuthState(cookies, stateParam);
    if (!stateData) {
        redirect(302, '/login?error=invalid_state');
    }

    if (stateData.provider !== providerName) {
        redirect(302, '/login?error=provider_mismatch');
    }

    try {
        const provider = await getProvider(providerName);

        // 3. code → access_token 교환
        let tokenResponse;
        if (provider instanceof TwitterProvider) {
            const codeVerifier = cookies.get('oauth_pkce') || undefined;
            cookies.delete('oauth_pkce', { path: '/' });
            tokenResponse = await provider.exchangeCode(code, codeVerifier);
        } else {
            tokenResponse = await provider.exchangeCode(code);
        }

        // 4. 사용자 프로필 조회
        let profile: OAuthUserProfile;
        if (provider instanceof AppleProvider) {
            profile = await provider.getUserProfile(
                tokenResponse.access_token,
                tokenResponse.id_token
            );
        } else {
            profile = await provider.getUserProfile(tokenResponse.access_token);
        }

        // 5. g5_member_social_profiles에서 기존 연결 확인
        const existingProfile = await findSocialProfile(providerName, profile.identifier);

        let mbId: string | null = null;

        if (existingProfile?.mb_id) {
            mbId = existingProfile.mb_id;
        } else if (profile.email) {
            const memberByEmail = await findMemberByEmail(profile.email);
            if (memberByEmail) {
                mbId = memberByEmail.mb_id;
            }
        }

        // 8. 회원 없으면 회원가입 페이지로 리다이렉트
        if (!mbId) {
            // 소셜 프로필 정보를 쿠키에 임시 저장 (회원가입 페이지에서 사용)
            cookies.set(
                'pending_social_register',
                JSON.stringify({
                    provider: providerName,
                    identifier: profile.identifier,
                    email: profile.email || '',
                    displayName: profile.displayName || '',
                    photoUrl: profile.photoUrl || '',
                    profileUrl: profile.profileUrl || ''
                }),
                {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: !dev,
                    maxAge: 60 * 10 // 10분
                }
            );

            const params = new URLSearchParams({ provider: providerName });
            if (profile.email) {
                params.set('email', profile.email);
            }
            if (stateData.redirect) {
                params.set('redirect', stateData.redirect);
            }
            redirect(302, `/register?${params.toString()}`);
        }

        // 회원 정보 조회 및 활성 상태 확인
        const member = await getMemberById(mbId);
        if (!member || !isMemberActive(member)) {
            redirect(302, '/login?error=account_inactive');
        }

        // 소셜 프로필 업데이트
        await upsertSocialProfile(mbId, providerName, profile);

        // 로그인 시각 업데이트
        await updateLoginTimestamp(mbId, clientIp);

        // 9. JWT 생성
        const accessToken = await generateAccessToken(member);
        const refreshToken = await generateRefreshToken(member.mb_id);

        // 10. refresh_token httpOnly 쿠키 설정
        cookies.set('refresh_token', refreshToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: 60 * 60 * 24 * 7
        });

        // access_token을 httpOnly 쿠키로 설정
        cookies.set('access_token', accessToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: 60 * 15 // 15분 (JWT 만료와 일치)
        });

        // 11. 원래 페이지로 리다이렉트
        redirect(302, stateData.redirect || '/');
    } catch (err) {
        // SvelteKit redirect/error는 다시 throw
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        console.error('[OAuth Callback]', providerName, err instanceof Error ? err.message : 'Unknown error');
        redirect(302, '/login?error=oauth_error');
    }
}

/** GET 콜백 (대부분의 프로바이더) */
export const GET: RequestHandler = async ({ url, cookies, getClientAddress }) => {
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
        redirect(302, `/login?error=provider_${errorParam}`);
    }

    if (!code || !stateParam) {
        redirect(302, '/login?error=missing_params');
    }

    const clientIp = getClientAddress();
    return handleCallback(url, cookies, code, stateParam, clientIp);
};

/** POST 콜백 (Apple response_mode=form_post) */
export const POST: RequestHandler = async ({ url, cookies, request, getClientAddress }) => {
    const formData = await request.formData();
    const code = formData.get('code') as string;
    const stateParam = formData.get('state') as string;
    const errorParam = formData.get('error') as string;

    if (errorParam) {
        redirect(302, `/login?error=provider_${errorParam}`);
    }

    if (!code || !stateParam) {
        redirect(302, '/login?error=missing_params');
    }

    const clientIp = getClientAddress();
    return handleCallback(url, cookies, code, stateParam, clientIp);
};

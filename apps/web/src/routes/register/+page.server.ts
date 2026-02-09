/**
 * 소셜 회원가입 서버 로직
 * OAuth 콜백에서 미가입자가 리다이렉트되어 옴
 */
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
    generateSocialMbId,
    validateNickname,
    isMbIdTaken,
    createMember
} from '$lib/server/auth/register.js';
import { upsertSocialProfile } from '$lib/server/auth/oauth/social-profile.js';
import { getMemberById, updateLoginTimestamp } from '$lib/server/auth/oauth/member.js';
import { generateAccessToken, generateRefreshToken } from '$lib/server/auth/jwt.js';
import type { OAuthUserProfile, SocialProvider } from '$lib/server/auth/oauth/types.js';

export const load: PageServerLoad = async ({ url, cookies }) => {
    const provider = url.searchParams.get('provider') || '';
    const email = url.searchParams.get('email') || '';
    const redirectUrl = url.searchParams.get('redirect') || '/';

    // 쿠키에서 소셜 프로필 정보 조회
    const pendingData = cookies.get('pending_social_register');
    if (!pendingData) {
        // 소셜 로그인을 거치지 않고 직접 접근 시
        redirect(302, '/login');
    }

    let socialProfile;
    try {
        socialProfile = JSON.parse(pendingData);
    } catch {
        redirect(302, '/login');
    }

    return {
        provider: socialProfile.provider || provider,
        email: socialProfile.email || email,
        displayName: socialProfile.displayName || '',
        redirectUrl
    };
};

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        const formData = await request.formData();
        const nickname = (formData.get('nickname') as string)?.trim() || '';
        const agreeTerms = formData.get('agree_terms') === 'on';
        const agreePrivacy = formData.get('agree_privacy') === 'on';
        const redirectUrl = (formData.get('redirect') as string) || '/';

        // 쿠키에서 소셜 프로필 정보 조회
        const pendingData = cookies.get('pending_social_register');
        if (!pendingData) {
            return fail(400, {
                error: '회원가입 세션이 만료되었습니다. 다시 소셜 로그인을 시도해주세요.',
                nickname
            });
        }

        let socialProfile: {
            provider: string;
            identifier: string;
            email: string;
            displayName: string;
            photoUrl: string;
            profileUrl: string;
        };
        try {
            socialProfile = JSON.parse(pendingData);
        } catch {
            return fail(400, {
                error: '잘못된 가입 정보입니다. 다시 시도해주세요.',
                nickname
            });
        }

        // 약관 동의 확인
        if (!agreeTerms || !agreePrivacy) {
            return fail(400, {
                error: '이용약관과 개인정보처리방침에 동의해주세요.',
                nickname
            });
        }

        // 닉네임 검증
        const nicknameResult = await validateNickname(nickname);
        if (!nicknameResult.valid) {
            return fail(400, {
                error: nicknameResult.error,
                nickname
            });
        }

        // mb_id 생성 (PHP 호환)
        let mbId = generateSocialMbId(socialProfile.provider, socialProfile.identifier);

        // 혹시 mb_id가 이미 존재하면 suffix 추가
        if (await isMbIdTaken(mbId)) {
            mbId = mbId + '_' + Date.now().toString(36).slice(-4);
        }

        const clientIp = getClientAddress();

        try {
            // g5_member INSERT
            await createMember({
                mb_id: mbId,
                mb_nick: nickname,
                mb_email: socialProfile.email,
                mb_name: nickname,
                mb_ip: clientIp
            });

            // 소셜 프로필 연결
            const oauthProfile: OAuthUserProfile = {
                provider: socialProfile.provider as SocialProvider,
                identifier: socialProfile.identifier,
                displayName: socialProfile.displayName,
                email: socialProfile.email,
                photoUrl: socialProfile.photoUrl,
                profileUrl: socialProfile.profileUrl
            };
            await upsertSocialProfile(mbId, socialProfile.provider, oauthProfile);

            // 로그인 시각 업데이트
            await updateLoginTimestamp(mbId, clientIp);

            // 회원 정보 조회 (JWT 생성용)
            const member = await getMemberById(mbId);
            if (!member) {
                return fail(500, {
                    error: '회원가입은 완료되었으나 로그인에 실패했습니다. 다시 로그인해주세요.',
                    nickname
                });
            }

            // JWT 생성
            const accessToken = await generateAccessToken(member);
            const refreshToken = await generateRefreshToken(member.mb_id);

            // 쿠키 설정
            cookies.set('refresh_token', refreshToken, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: !dev,
                maxAge: 60 * 60 * 24 * 7
            });

            cookies.set('access_token', accessToken, {
                path: '/',
                httpOnly: false,
                sameSite: 'lax',
                secure: !dev,
                maxAge: 60
            });

            // 가입 완료 후 임시 쿠키 삭제
            cookies.delete('pending_social_register', { path: '/' });

            // 리다이렉트
            redirect(302, redirectUrl);
        } catch (err) {
            // SvelteKit redirect는 다시 throw
            if (err && typeof err === 'object' && 'status' in err) {
                throw err;
            }

            console.error('[Register] 회원가입 실패:', err);
            return fail(500, {
                error: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                nickname
            });
        }
    }
};

/**
 * 소셜 회원가입 서버 로직
 * OAuth 콜백에서 미가입자가 리다이렉트되어 옴
 */
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { randomBytes } from 'crypto';
import {
    generateSocialMbId,
    validateNickname,
    validateMbId,
    isMbIdTaken,
    createMember
} from '$lib/server/auth/register.js';
import { upsertSocialProfile } from '$lib/server/auth/oauth/social-profile.js';
import { getMemberById, updateLoginTimestamp } from '$lib/server/auth/oauth/member.js';
import { generateRefreshToken, generateDamoangJWT } from '$lib/server/auth/jwt.js';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import type { OAuthUserProfile, SocialProvider } from '$lib/server/auth/oauth/types.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { verifyTurnstile } from '$lib/server/captcha.js';
import { checkRateLimit, recordAttempt } from '$lib/server/rate-limit.js';
import { getCertConfig } from '$lib/server/auth/cert-inicis.js';
import { getContent, getSiteTitle, replaceContentVariables } from '$lib/server/content.js';
import { sanitizePostContent } from '$lib/server/sanitize.js';
import { grantLoginXP } from '$lib/server/auth/xp-grant.js';
import { grantLoginPoint } from '$lib/server/auth/point-grant.js';
import { env } from '$env/dynamic/private';
import { safeRedirectUrl } from '$lib/server/safe-redirect.js';

const COOKIE_DOMAIN = env.COOKIE_DOMAIN || undefined;
const AUTH_EVENT_COOKIE = 'ga4_auth_event';

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

    const isInviteFlow = redirectUrl.includes('ads.damoang.net/invite/');

    // 약관/개인정보처리방침/이용제한사유 + 광고주 약관(초대 시) 로드
    const [termsContent, privacyContent, policyContent, siteTitle, contractContent] =
        await Promise.all([
            getContent('provision'),
            getContent('privacy'),
            getContent('operation_policy_add'),
            getSiteTitle(),
            isInviteFlow ? getContent('contract') : Promise.resolve(null)
        ]);

    return {
        provider: socialProfile.provider || provider,
        email: socialProfile.email || email,
        displayName: socialProfile.displayName || '',
        redirectUrl,
        isInviteFlow,
        termsHtml: termsContent
            ? sanitizePostContent(replaceContentVariables(termsContent.co_content, siteTitle))
            : '',
        privacyHtml: privacyContent
            ? sanitizePostContent(replaceContentVariables(privacyContent.co_content, siteTitle))
            : '',
        policyHtml: policyContent
            ? sanitizePostContent(replaceContentVariables(policyContent.co_content, siteTitle))
            : '',
        contractHtml: contractContent
            ? sanitizePostContent(replaceContentVariables(contractContent.co_content, siteTitle))
            : ''
    };
};

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        console.log('[Register] Action started');
        const clientIp = getClientAddress();
        const formData = await request.formData();
        const nickname = (formData.get('nickname') as string)?.trim() || '';
        const agreeTerms = formData.get('agree_terms') === 'on';
        const agreePrivacy = formData.get('agree_privacy') === 'on';
        const redirectUrl = safeRedirectUrl(formData.get('redirect') as string);

        // Rate limit 체크 (5회/시간)
        const rateCheck = checkRateLimit(clientIp, 'register', 5, 60 * 60 * 1000);
        if (!rateCheck.allowed) {
            return fail(429, {
                error: `요청이 너무 많습니다. ${rateCheck.retryAfter}초 후 다시 시도해주세요.`,
                nickname
            });
        }
        recordAttempt(clientIp, 'register');

        // Turnstile CAPTCHA 검증 (초대 플로우는 소셜 인증 완료 상태이므로 스킵)
        const isInviteFlow = redirectUrl.includes('ads.damoang.net/invite/');
        if (!isInviteFlow) {
            const turnstileToken = (formData.get('cf-turnstile-response') as string) || '';
            const captchaValid = await verifyTurnstile(turnstileToken, clientIp);
            if (!captchaValid) {
                return fail(400, {
                    error: '자동 가입 방지 확인에 실패했습니다. 다시 시도해주세요.',
                    nickname
                });
            }
        }

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

        // 초대 플로우: 광고주 약관 동의 확인
        if (isInviteFlow) {
            const agreeContract = formData.get('agree_contract') === 'on';
            if (!agreeContract) {
                return fail(400, {
                    error: '광고주 약관에 동의해주세요.',
                    nickname
                });
            }
        }

        // 닉네임 검증
        const nicknameResult = await validateNickname(nickname);
        if (!nicknameResult.valid) {
            return fail(400, {
                error: nicknameResult.error,
                nickname
            });
        }

        // mb_id: 초대 플로우는 사용자 입력, 일반은 소셜 프로바이더 기반 자동 생성
        let mbId: string;
        if (isInviteFlow) {
            const customMbId = (formData.get('mb_id') as string)?.trim().toLowerCase() || '';
            const mbIdResult = await validateMbId(customMbId);
            if (!mbIdResult.valid) {
                return fail(400, {
                    error: mbIdResult.error,
                    nickname
                });
            }
            mbId = customMbId;
        } else {
            mbId = generateSocialMbId(socialProfile.provider, socialProfile.identifier);
            if (await isMbIdTaken(mbId)) {
                mbId = mbId + '_' + randomBytes(4).toString('hex');
            }
        }

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

            // 가입 첫 로그인 XP + 포인트 적립
            await Promise.allSettled([grantLoginXP(mbId), grantLoginPoint(mbId)]);

            // 회원 정보 조회 (JWT 생성용)
            const member = await getMemberById(mbId);
            if (!member) {
                return fail(500, {
                    error: '회원가입은 완료되었으나 로그인에 실패했습니다. 다시 로그인해주세요.',
                    nickname
                });
            }

            // 서버사이드 세션 생성
            const session = await createSession(member.mb_id, {
                ip: clientIp
            });

            const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};

            // 세션 쿠키 설정
            cookies.set(SESSION_COOKIE_NAME, session.sessionId, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: !dev,
                maxAge: SESSION_COOKIE_MAX_AGE,
                ...domainOpt
            });

            cookies.set(CSRF_COOKIE_NAME, session.csrfToken, {
                path: '/',
                httpOnly: false,
                sameSite: 'strict',
                secure: !dev,
                maxAge: SESSION_COOKIE_MAX_AGE,
                ...domainOpt
            });

            // 레거시 호환: refresh_token도 생성
            const { token: refreshToken } = await generateRefreshToken(member.mb_id, {
                ip: clientIp
            });
            cookies.set('refresh_token', refreshToken, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: !dev,
                maxAge: 60 * 60 * 24 * 7,
                ...domainOpt
            });

            cookies.set(AUTH_EVENT_COOKIE, `sign_up:${socialProfile.provider}`, {
                path: '/',
                httpOnly: false,
                sameSite: 'lax',
                secure: !dev,
                maxAge: 120,
                ...domainOpt
            });

            // SSO 쿠키 설정 (ads.damoang.net 등 Go 서비스 인증용)
            try {
                await setDamoangSSOCookie(cookies, {
                    mb_id: member.mb_id,
                    mb_level: member.mb_level ?? 0,
                    mb_name: member.mb_name || member.mb_nick,
                    mb_email: member.mb_email
                });
            } catch {
                // SSO 쿠키 실패해도 가입은 진행
            }

            // 가입 완료 후 임시 쿠키 삭제
            cookies.delete('pending_social_register', { path: '/' });
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

        // 초대 플로우: ads API 서버사이드 호출 후 완료 페이지로 리다이렉트
        if (isInviteFlow) {
            const tokenMatch = redirectUrl.match(/invite\/([a-f0-9]+)/);
            const inviteToken = tokenMatch?.[1];

            if (inviteToken) {
                try {
                    const inviteMember = await getMemberById(mbId);
                    const jwtToken = await generateDamoangJWT({
                        mb_id: mbId,
                        mb_level: inviteMember?.mb_level ?? 0,
                        mb_name: inviteMember?.mb_name || nickname,
                        mb_email: socialProfile.email
                    });

                    const confirmRes = await fetch(
                        `https://ads.damoang.net/api/v1/invite/${inviteToken}/confirm`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Cookie: `damoang_jwt=${jwtToken}`
                            },
                            body: JSON.stringify({
                                type: 'create_account',
                                mbId: mbId,
                                mbNick: nickname
                            })
                        }
                    );

                    const result = await confirmRes.json();
                    if (result.success) {
                        redirect(302, '/register/invite-complete');
                    }
                    console.error('[Register] Invite confirm failed:', result.message);
                } catch (err) {
                    // SvelteKit redirect는 다시 throw
                    if (err && typeof err === 'object' && 'status' in err) {
                        throw err;
                    }
                    console.error('[Register] Invite confirm error:', err);
                }
            }
            // 실패 시 기존 동작 (ads 초대페이지로 리다이렉트)
            redirect(302, redirectUrl);
        }

        // 실명인증 활성화 시 인증 페이지로
        try {
            const certConfig = await getCertConfig();
            console.log('[Register] certConfig:', JSON.stringify(certConfig));
            if (certConfig.certUse > 0) {
                console.log('[Register] Redirecting to /register/cert');
                redirect(302, '/register/cert');
            }
        } catch (err) {
            if (err && typeof err === 'object' && 'status' in err) {
                throw err;
            }
            console.error('[Register] getCertConfig error:', err);
        }

        redirect(302, redirectUrl);
    }
};

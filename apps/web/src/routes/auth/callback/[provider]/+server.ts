/**
 * OAuth 콜백 라우트
 * GET /auth/callback/naver?code=xxx&state=yyy
 * POST /auth/callback/apple (response_mode=form_post)
 */
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { normalizeProviderName, getProvider } from '$lib/server/auth/oauth/provider-registry.js';
import { resolveOrigin } from '$lib/server/auth/oauth/config.js';
import { safeRedirectUrl } from '$lib/server/safe-redirect.js';
import { validateOAuthState, peekAppMode } from '$lib/server/auth/oauth/state.js';
import {
    findSocialProfile,
    linkSocialProfile,
    upsertSocialProfile
} from '$lib/server/auth/oauth/social-profile.js';
import {
    getMemberById,
    findMemberByEmail,
    isMemberActive,
    invalidateMemberCache
} from '$lib/server/auth/oauth/member.js';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import { generateRefreshToken, generateAppLoginCode } from '$lib/server/auth/jwt.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { AppleProvider } from '$lib/server/auth/oauth/providers/apple.js';
import { TwitterProvider } from '$lib/server/auth/oauth/providers/twitter.js';
import type { OAuthUserProfile } from '$lib/server/auth/oauth/types.js';
import { getCertConfig } from '$lib/server/auth/cert-inicis.js';
import { runSocialLoginPostProcess } from '$lib/server/auth/social-login-postprocess.js';
import {
    generateSocialMbId,
    isMbIdTaken,
    isNicknameTaken,
    createMember,
    findExistingTempAccount
} from '$lib/server/auth/register.js';
import {
    WITHDRAWAL_GRACE_COOKIE,
    computeWithdrawalGrace,
    signWithdrawalGraceToken
} from '$lib/server/auth/withdrawal.js';

// 미설정 시 .damoang.net 으로 폴백 — host-only 쿠키가 되면 새 탭/PWA 에서 세션이 격리됨 (#12260, #12179).
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || (dev ? undefined : '.damoang.net');

const AUTH_EVENT_COOKIE = 'ga4_auth_event';

function isAdsInviteFlow(redirectUrl: string | null | undefined): boolean {
    return !!redirectUrl && redirectUrl.includes('ads.damoang.net/invite/');
}

function isOpsInviteFlow(redirectUrl: string | null | undefined): boolean {
    if (!redirectUrl) return false;
    return (
        redirectUrl.includes('://ops.damoang.net/invite/') ||
        redirectUrl.includes('://damoang.net/invite/')
    );
}

function isInviteFlow(redirectUrl: string | null | undefined): boolean {
    return isAdsInviteFlow(redirectUrl) || isOpsInviteFlow(redirectUrl);
}

function isPromotionRedirectFlow(redirectUrl: string | null | undefined): boolean {
    if (!redirectUrl) return false;
    return (
        redirectUrl.startsWith('/promotion') ||
        redirectUrl.includes('://damoang.net/promotion') ||
        redirectUrl.includes('://www.damoang.net/promotion')
    );
}

function buildInviteTempNickname(provider: string): string {
    const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
    const providerPart =
        provider
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 6) || 'social';
    return `tmp_${providerPart}_${randomPart}`.slice(0, 20);
}

async function generateInviteTempNickname(provider: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
        const candidate = buildInviteTempNickname(provider);
        if (!(await isNicknameTaken(candidate))) {
            return candidate;
        }
    }
    throw new Error('초대 임시 닉네임 생성에 실패했습니다.');
}

/**
 * 에러 리다이렉트. 네이티브 앱 모드(appMode)면 앱 스킴(damoang://oauth-callback?error=)으로 복귀시켜
 * 인앱 브라우저가 웹 /login 에 갇히는 것을 방지한다. 아니면 기존대로 웹 로그인으로.
 */
function redirectError(errorCode: string, appMode: boolean): never {
    if (appMode) {
        redirect(302, `damoang://oauth-callback?error=${encodeURIComponent(errorCode)}`);
    }
    redirect(302, `/login?error=${encodeURIComponent(errorCode)}`);
}

/** 공통 콜백 처리 로직 */
async function handleCallback(
    providerSlug: string,
    cookies: Parameters<RequestHandler>[0]['cookies'],
    locals: Parameters<RequestHandler>[0]['locals'],
    code: string,
    stateParam: string,
    clientIp: string,
    origin: string
): Promise<never> {
    // 1. URL 경로 파라미터에서 프로바이더 추출
    const providerName = normalizeProviderName(providerSlug);
    if (!providerName) {
        redirectError('invalid_provider', peekAppMode(cookies, stateParam));
    }

    // 2. state 검증 (CSRF)
    const stateData = validateOAuthState(cookies, stateParam);
    if (!stateData) {
        redirectError('invalid_state', peekAppMode(cookies, stateParam));
    }

    if (stateData.provider !== providerName) {
        redirectError('provider_mismatch', stateData.appMode === true);
    }

    try {
        const provider = await getProvider(providerName, origin);

        // 3. code → access_token 교환
        let tokenResponse;
        if (provider instanceof TwitterProvider) {
            const codeVerifier = cookies.get('oauth_pkce') || undefined;
            cookies.delete('oauth_pkce', {
                path: '/',
                ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN })
            });
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

        // 4-link. 추가 연결 모드(link)면 신규가입/세션재발급 로직을 모두 우회 (#12037)
        if (stateData.linkTo) {
            // 세션 재검증: state.linkTo 와 현재 로그인 세션이 정확히 일치해야 함
            const sessionMbId = locals.user?.id;
            if (!sessionMbId) {
                redirect(
                    302,
                    `/login?redirect=${encodeURIComponent(stateData.redirect || '/member/settings')}`
                );
            }
            if (sessionMbId !== stateData.linkTo) {
                redirect(302, '/member/settings?error=link_session_mismatch');
            }

            try {
                await linkSocialProfile(stateData.linkTo, providerName, profile);
            } catch (linkErr) {
                if (
                    linkErr instanceof Error &&
                    (linkErr as Error & { code?: string }).code === 'already_linked_other'
                ) {
                    redirect(
                        302,
                        `/member/settings?error=already_linked_other&provider=${providerName}`
                    );
                }
                console.error('[OAuth Link]', providerName, linkErr);
                redirect(302, `/member/settings?error=link_failed&provider=${providerName}`);
            }

            // 회원 캐시 무효화 후 세션 유지하며 설정 페이지로
            await invalidateMemberCache(stateData.linkTo);
            redirect(302, `/member/settings?linked=${providerName}`);
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

        // 회원 없으면 초대 플로우는 즉시 임시 계정 생성 후 복귀, 일반 플로우만 register로 이동
        if (!mbId) {
            // 이메일 중복 체크 (초대 플로우 포함): 같은 이메일 계정이 있으면 가입 차단
            if (profile.email) {
                const existingByEmail = await findMemberByEmail(profile.email);
                if (existingByEmail) {
                    if (stateData.appMode) {
                        redirect(302, 'damoang://oauth-callback?error=email_exists');
                    }
                    redirect(302, '/login?error=email_exists');
                }
            }

            // 앱 모드 신규가입 가드(#no-account-guard): 초대 플로우가 아니고, no_account 를 이해하는
            // 신규 앱(nac=1)이며, 사용자가 명시적으로 "새로 시작"(signup=1)을 누르지 않았다면,
            // 조용히 임시 계정을 만들지 않고 앱에 no_account 로 복귀시킨다. 앱이 "연결된 계정 없음"을
            // 안내하고 재시도(signup=1)할 때만 생성된다. 구버전 앱(nac 미전송)은 기존 동작(자동생성) 유지.
            if (
                stateData.appMode &&
                stateData.noAccountCapable &&
                !stateData.allowSignup &&
                !isInviteFlow(stateData.redirect)
            ) {
                redirect(
                    302,
                    `damoang://oauth-callback?error=no_account&provider=${encodeURIComponent(providerName)}`
                );
            }

            if (isInviteFlow(stateData.redirect) || stateData.appMode) {
                // 초대 플로우·네이티브 앱 로그인: /register 로 보내지 않고 임시 계정 즉시 생성
                // (앱 모드에서 /register 로 이동하면 앱 스킴 복귀가 끊겨 로그인이 중단됨)
                const baseMbId = generateSocialMbId(providerName, profile.identifier);
                const existingTemp = await findExistingTempAccount(baseMbId);

                if (existingTemp) {
                    // 이전 초대 시도에서 생성된 임시 계정 재사용 (중복 방지)
                    mbId = existingTemp.mb_id;
                } else {
                    const nickname = await generateInviteTempNickname(providerName);
                    mbId = baseMbId;
                    if (await isMbIdTaken(mbId)) {
                        mbId = `${mbId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
                    }

                    await createMember({
                        mb_id: mbId,
                        mb_nick: nickname,
                        mb_email: profile.email || '',
                        mb_name: nickname,
                        mb_ip: clientIp,
                        skipNickLock: true
                    });
                }
            } else {
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
                        maxAge: 60 * 10
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
        }

        // 회원 정보 조회 및 활성 상태 확인
        let member = await getMemberById(mbId);

        // 초대 플로우에서 캐시 무효화 후 재조회 (관리자가 복구한 계정의 캐시 지연 대응)
        if (isInviteFlow(stateData.redirect) && member && !isMemberActive(member)) {
            await invalidateMemberCache(mbId);
            member = await getMemberById(mbId);
        }

        if (!member || !isMemberActive(member)) {
            if (isInviteFlow(stateData.redirect)) {
                // 비활성 회원 → 임시 계정 생성 (ads 초대 패턴 동일)
                const baseMbId = generateSocialMbId(providerName, profile.identifier);
                const existingTemp = await findExistingTempAccount(baseMbId);
                if (existingTemp) {
                    mbId = existingTemp.mb_id;
                } else {
                    const nickname = await generateInviteTempNickname(providerName);
                    mbId = baseMbId;
                    if (await isMbIdTaken(mbId)) {
                        mbId = `${mbId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
                    }
                    await createMember({
                        mb_id: mbId,
                        mb_nick: nickname,
                        mb_email: profile.email || '',
                        mb_name: nickname,
                        mb_ip: clientIp,
                        skipNickLock: true
                    });
                }
                member = await getMemberById(mbId);
                if (!member) {
                    redirect(302, '/login?error=account_inactive');
                }
            } else {
                // 탈퇴 숙려기간(30일) 중 & 취소 가능 → 탈퇴 취소 화면으로 인계.
                // 완전한 로그인 세션 대신 단기 서명 쿠키만 발급한다.
                const grace = member ? computeWithdrawalGrace(member) : null;
                if (member && grace?.inGrace) {
                    const graceToken = await signWithdrawalGraceToken(member.mb_id);
                    cookies.set(WITHDRAWAL_GRACE_COOKIE, graceToken, {
                        path: '/',
                        httpOnly: true,
                        sameSite: 'lax',
                        secure: !dev,
                        maxAge: 60 * 15,
                        ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
                    });
                    redirect(302, '/member/leave/cancel');
                }
                if (stateData.appMode) {
                    // 앱 모드: 비활성/이용제한 계정은 앱으로 에러 복귀 (임시계정 우회 생성 금지)
                    redirect(302, 'damoang://oauth-callback?error=account_inactive');
                }
                redirect(302, '/login?error=account_inactive');
            }
        }

        // 소셜 프로필 업데이트
        await upsertSocialProfile(mbId, providerName, profile);

        await runSocialLoginPostProcess(mbId, clientIp, member.mb_leave_reason);

        // 서버사이드 세션 생성
        const session = await createSession(member.mb_id, {
            ip: clientIp,
            userAgent: ''
        });

        const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};

        // 세션 쿠키 설정 (httpOnly, 서브도메인 공유)
        cookies.set(SESSION_COOKIE_NAME, session.sessionId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        // CSRF 토큰 쿠키 (non-httpOnly, JS에서 읽어 헤더로 전송)
        // sameSite=strict 는 OAuth cross-site 콜백에서 쿠키 설정을 차단해 검증 실패를
        // 야기했음 (#12260, #12179). 'lax' 로 완화해도 GET 외 요청은 여전히
        // 차단되며, 본 토큰은 항상 헤더로 명시 전송되므로 CSRF 보호는 유지된다.
        cookies.set(CSRF_COOKIE_NAME, session.csrfToken, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: !dev,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        cookies.set(
            AUTH_EVENT_COOKIE,
            `${existingProfile || mbId ? 'login' : 'sign_up'}:${providerName}`,
            {
                path: '/',
                httpOnly: false,
                sameSite: 'lax',
                secure: !dev,
                maxAge: 120,
                ...domainOpt
            }
        );

        // 레거시 호환: refresh_token 생성 (서브도메인 인증용)
        const { token: refreshToken } = await generateRefreshToken(member.mb_id, {
            ip: clientIp,
            userAgent: ''
        });
        cookies.set('refresh_token', refreshToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: 60 * 60 * 24 * 7,
            ...domainOpt
        });

        // 서브도메인 SSO: damoang_jwt 쿠키 발급 (ads.damoang.net 등 Go 서비스 인증용)
        try {
            await setDamoangSSOCookie(cookies, {
                mb_id: member.mb_id,
                mb_level: member.mb_level ?? 0,
                mb_name: member.mb_name || member.mb_nick,
                mb_email: member.mb_email
            });
        } catch (e) {
            console.error('[OAuth Callback] SSO cookie 발급 실패:', e);
        }

        const skipCertification =
            isInviteFlow(stateData.redirect) ||
            isPromotionRedirectFlow(stateData.redirect) ||
            stateData.appMode === true ||
            Number(member.mb_level ?? 0) >= 5;

        // 직접홍보/광고주 로그인은 실명인증 없이 진행
        if (!skipCertification && !member.mb_certify) {
            try {
                const certConfig = await getCertConfig();
                if (certConfig.certUse > 0) {
                    redirect(302, '/register/cert');
                }
            } catch (certErr) {
                if (certErr && typeof certErr === 'object' && 'status' in certErr) throw certErr;
            }
        }

        // 네이티브 앱 모드: 단명 app-login 코드를 발급해 앱 스킴으로 복귀
        if (stateData.appMode) {
            const appLoginCode = await generateAppLoginCode({
                mb_id: member.mb_id,
                mb_nick: member.mb_nick,
                mb_level: Number(member.mb_level ?? 1),
                mb_email: member.mb_email || ''
            });
            redirect(302, `damoang://oauth-callback?code=${encodeURIComponent(appLoginCode)}`);
        }

        // 원래 페이지로 리다이렉트
        redirect(302, safeRedirectUrl(stateData.redirect));
    } catch (err) {
        // SvelteKit redirect/error는 다시 throw
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        console.error(
            '[OAuth Callback]',
            providerName,
            err instanceof Error ? err.message : 'Unknown error'
        );
        redirectError('oauth_error', stateData.appMode === true);
    }
}

/** GET 콜백 (대부분의 프로바이더) */
export const GET: RequestHandler = async ({
    url,
    cookies,
    request,
    getClientAddress,
    params,
    locals
}) => {
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
        redirectError(`provider_${errorParam}`, peekAppMode(cookies, stateParam));
    }

    if (!code || !stateParam) {
        redirectError('missing_params', peekAppMode(cookies, stateParam));
    }

    const clientIp = getClientAddress();
    const origin = resolveOrigin(request);
    return handleCallback(params.provider!, cookies, locals, code, stateParam, clientIp, origin);
};

/** POST 콜백 (Apple response_mode=form_post) */
export const POST: RequestHandler = async ({
    cookies,
    request,
    getClientAddress,
    params,
    locals
}) => {
    const formData = await request.formData();
    const code = formData.get('code') as string;
    const stateParam = formData.get('state') as string;
    const errorParam = formData.get('error') as string;

    if (errorParam) {
        redirectError(`provider_${errorParam}`, peekAppMode(cookies, stateParam));
    }

    if (!code || !stateParam) {
        redirectError('missing_params', peekAppMode(cookies, stateParam));
    }

    const clientIp = getClientAddress();
    const origin = resolveOrigin(request);
    return handleCallback(params.provider!, cookies, locals, code, stateParam, clientIp, origin);
};

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
    appendMbIdSuffix,
    validateNickname,
    isNicknameTaken,
    isMbIdTaken,
    createMember,
    inspectSocialMbIdOccupant,
    reactivateMember
} from '$lib/server/auth/register.js';
import { upsertSocialProfile } from '$lib/server/auth/oauth/social-profile.js';
import {
    ACCOUNT_RECOVERY_LOCKED,
    ACCOUNT_RECOVERY_LOCKED_MESSAGE
} from '$lib/server/auth/account-recovery-lock.js';
import {
    getMemberById,
    updateLoginTimestamp,
    findMemberByEmail
} from '$lib/server/auth/oauth/member.js';
import { generateRefreshToken } from '$lib/server/auth/jwt.js';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import type { OAuthUserProfile, SocialProvider } from '$lib/server/auth/oauth/types.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { verifyTurnstile } from '$lib/server/captcha.js';
import { checkRateLimit, recordAttempt, resolveClientIp } from '$lib/server/rate-limit.js';
import { observeBinding } from '$lib/server/auth/oauth/binding-observer.js';
import { getCertConfig } from '$lib/server/auth/cert-inicis.js';
import { getContent, getSiteTitle, replaceContentVariables } from '$lib/server/content.js';
import { sanitizePostContent } from '$lib/server/sanitize.js';
import { grantLoginXP } from '$lib/server/auth/xp-grant.js';
import { grantLoginPoint } from '$lib/server/auth/point-grant.js';
import { env } from '$env/dynamic/private';
import { safeRedirectUrl } from '$lib/server/safe-redirect.js';

// 미설정 시 prod 에서 .damoang.net 으로 폴백 — host-only 쿠키 시 새 탭/PWA 세션 격리 (#12260, #12179).
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || (dev ? undefined : '.damoang.net');
const AUTH_EVENT_COOKIE = 'ga4_auth_event';

function buildInviteTempNickname(provider: string): string {
    const providerPart =
        provider
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 6) || 'social';
    const randomPart = randomBytes(3).toString('hex');
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

export const load: PageServerLoad = async ({ url, cookies, request, getClientAddress }) => {
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

    /**
     * 탈퇴한 옛 계정이 있는 것 같지만 소유를 자동으로 확인할 수 없는 경우.
     *
     * ⛔ 2026-07 이전 탈퇴 경로가 소셜 프로필 행을 하드삭제해서 대조할 근거가 없다
     *    (그 경로는 지금 죽어 있다. 라이브 탈퇴는 프로필을 건드리지 않는다).
     *    자동 복구는 위험하고, 조용히 새 계정만 내주면 옛 글·이력을 잃은 줄도 모르신다.
     *    그래서 가입은 그대로 진행하되 안내를 띄우고 사람이 확인한다.
     */
    let manualRecovery = false;

    // 같은 소셜 계정으로 만들어진 계정이 이미 있으면 재가입이 아니라 복원 대상이다.
    // 개인정보처리방침상 DI 를 반영구 보관하며 중복 가입을 막고 있으므로, 탈퇴자의
    // 재가입은 애초에 성립하지 않는다. 그동안 운영에서 수동으로 복원해 주던 것을
    // 이 경로로 자동화한다.
    // 초대 플로우는 광고 계정용 임시 계정 발급이라 대상이 아니다.
    if (!isInviteFlow && socialProfile.identifier) {
        const occupant = await inspectSocialMbIdOccupant(
            socialProfile.provider,
            socialProfile.identifier
        );
        if (occupant.kind === 'blocked') {
            redirect(302, '/login?error=account_blocked');
        }
        // ⭐ `owned` 일 때만 복구로 보낸다. 해시만 겹친 `unverified` 를 보내면
        //    남의 계정을 "당신의 이전 계정"이라고 안내하게 된다(2026-08-26 실사고).
        if (!ACCOUNT_RECOVERY_LOCKED && occupant.kind === 'owned') {
            redirect(302, '/register/recover');
        }
        // 해시만 겹친 경우. 새 계정으로 가입시키되, 옛 계정을 잃는 분이 생기므로
        // 탈퇴 계정이면 안내를 띄운다(아래 manualRecovery).
        if (occupant.kind === 'unverified') {
            manualRecovery = occupant.withdrawn && !occupant.hasProfileRows;
            // ⛔ 이 분기가 몇 명에게 걸리는지 남긴다. 이 수치가 없어서 지난 조사에서
            //    11명의 피해 여부를 가리지 못했다.
            await observeBinding('occupant_unverified_recovery_denied', {
                mbId: occupant.mbId,
                provider: socialProfile.provider,
                identifier: socialProfile.identifier,
                clientIp: resolveClientIp(getClientAddress, request) ?? ''
            });
        }
    }

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
        manualRecovery,
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
        // [B 인증·남용 방지] IP 를 못 구해도 **제한을 건너뛰지 않는다.**
        // ⛔ 건너뛰면 로그인·가입 무제한 시도가 조용히 열린다. 막히면 즉시 제보가 들어오지만
        //    뚫리면 아무도 모른다 — fail-closed 를 택한다(2026-08-19).
        // ⛔ 기록·캡차에는 공용 버킷 키를 쓰지 않는다. 'unknown' 이 mb_ip 에 저장되거나
        //    Turnstile remoteip 로 나가면 데이터가 오염되고 검증이 깨진다.
        const resolvedIp = resolveClientIp(getClientAddress, request);
        const clientIp = resolvedIp ?? '';
        const rateKey = resolvedIp ?? 'unknown';
        const formData = await request.formData();
        const redirectUrl = safeRedirectUrl(formData.get('redirect') as string);
        const isInviteFlow = redirectUrl.includes('ads.damoang.net/invite/');
        let nickname = (formData.get('nickname') as string)?.trim() || '';
        const agreeTerms = formData.get('agree_terms') === 'on';
        const agreePrivacy = formData.get('agree_privacy') === 'on';
        // 이전 계정 복구 요청. 새 계정을 만들지 않고 옛 계정으로 로그인시킨다.
        const isRecovery = formData.get('intent') === 'recover';

        // Rate limit 체크 (5회/시간)
        const rateCheck = checkRateLimit(rateKey, 'register', 5, 60 * 60 * 1000);
        if (!rateCheck.allowed) {
            return fail(429, {
                error: `요청이 너무 많습니다. ${rateCheck.retryAfter}초 후 다시 시도해주세요.`,
                nickname
            });
        }
        recordAttempt(rateKey, 'register');

        // Turnstile CAPTCHA 검증 (초대·복구 플로우는 소셜 인증 완료 상태이므로 스킵)
        if (!isInviteFlow && !isRecovery) {
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

        let mbId: string;
        if (isRecovery && ACCOUNT_RECOVERY_LOCKED) {
            // ⛔ 화면 진입을 막아도 폼을 직접 POST 할 수 있다. 여기서 다시 막는다.
            cookies.delete('pending_social_register', { path: '/' });
            return fail(423, { error: ACCOUNT_RECOVERY_LOCKED_MESSAGE, nickname });
        }
        if (isRecovery) {
            // 복구 경로: 닉네임·약관 절차 없이 옛 계정으로 이어붙인다.
            // 이 경로에 도달했다는 것 자체가 같은 소셜 sub 으로 로그인했다는 뜻이므로
            // 본인 확인은 소셜 로그인 자기증명으로 충족된다(DI 보다 강한 근거).
            const occupant = await inspectSocialMbIdOccupant(
                socialProfile.provider,
                socialProfile.identifier
            );
            // ⛔ `owned` 가 아니면 절대 내주지 않는다. 화면을 막아도 폼은 직접 POST 할 수 있으므로
            //    최종 판정은 여기서 한다. `unverified` 는 해시만 겹친 **남의 계정**일 수 있다.
            if (occupant.kind !== 'owned') {
                cookies.delete('pending_social_register', { path: '/' });
                return fail(400, {
                    error:
                        occupant.kind === 'blocked'
                            ? '이용이 제한된 계정입니다. 자세한 내용은 고객센터로 문의해주세요.'
                            : occupant.kind === 'unverified'
                              ? '이 계정이 회원님의 것인지 자동으로 확인하지 못했습니다. contact@damoang.net 으로 문의해 주시면 확인 후 도와드리겠습니다.'
                              : '복구할 이전 계정을 찾지 못했습니다. 다시 시도해주세요.',
                    nickname
                });
            }
            mbId = occupant.mbId;
            nickname = occupant.nick;
            if (occupant.withdrawn) {
                await reactivateMember(
                    mbId,
                    '[계정복구] 동일 소셜 계정 재로그인으로 본인 확인 후 재활성(F3)'
                );
            }
        } else if (isInviteFlow) {
            nickname = await generateInviteTempNickname(socialProfile.provider);
            mbId = generateSocialMbId(socialProfile.provider, socialProfile.identifier);
            if (await isMbIdTaken(mbId)) {
                mbId = appendMbIdSuffix(mbId);
            }
        } else {
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
            // 검증기가 안 보이는 문자(제로폭·전각공백 등)를 제거한 정규화 값을 저장한다.
            nickname = nicknameResult.normalized ?? nickname;

            // 같은 소셜 계정으로 만들어진 계정이 이미 있으면 새로 만들지 않는다.
            // ⛔ 단 「mb_id 충돌 = 동일인」이 아니다. 소유가 확인된 `owned` 만 그렇다.
            const occupant = await inspectSocialMbIdOccupant(
                socialProfile.provider,
                socialProfile.identifier
            );
            if (occupant.kind === 'blocked') {
                cookies.delete('pending_social_register', { path: '/' });
                return fail(400, {
                    error: '이용이 제한된 계정입니다. 자세한 내용은 고객센터로 문의해주세요.',
                    nickname
                });
            }
            if (!ACCOUNT_RECOVERY_LOCKED && occupant.kind === 'owned') {
                return fail(409, {
                    error: '이전에 사용하시던 계정이 있습니다. 그 계정으로 이어서 이용하실 수 있습니다.',
                    nickname,
                    needsRecovery: true
                });
            }

            // ⛔ 점유 계정을 그대로 내주지 않는다. 해시가 겹쳤다고 같은 사람이라는
            //    보장이 없다(`unverified`). 이미 쓰이는 mb_id 면 접미사를 붙여 새로 만든다.
            mbId = occupant.mbId;
            if (await isMbIdTaken(mbId)) {
                mbId = appendMbIdSuffix(mbId);
            }
        }

        // 이메일 중복 체크: 같은 이메일로 가입된 계정이 있으면 가입 차단.
        // 복구 경로는 옛 계정 자신이 걸리므로 건너뛴다.
        if (!isRecovery && socialProfile.email) {
            const existingByEmail = await findMemberByEmail(socialProfile.email);
            if (existingByEmail) {
                cookies.delete('pending_social_register', { path: '/' });
                return fail(400, {
                    error: '이미 이 이메일로 가입된 계정이 있습니다. 기존 소셜 계정으로 로그인해주세요.',
                    nickname
                });
            }
        }

        try {
            // g5_member INSERT (복구 경로는 이미 존재하는 계정이므로 생성하지 않는다)
            if (!isRecovery) {
                await createMember({
                    mb_id: mbId,
                    mb_nick: nickname,
                    mb_email: socialProfile.email,
                    mb_name: nickname,
                    mb_ip: clientIp
                });
            }

            // 소셜 프로필 연결
            const oauthProfile: OAuthUserProfile = {
                provider: socialProfile.provider as SocialProvider,
                identifier: socialProfile.identifier,
                displayName: socialProfile.displayName,
                email: socialProfile.email,
                photoUrl: socialProfile.photoUrl,
                profileUrl: socialProfile.profileUrl
            };
            await upsertSocialProfile(mbId, socialProfile.provider, oauthProfile, clientIp);

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

            // CSRF 토큰 쿠키: 'strict' 는 OAuth/외부 콜백 후 cross-site 진입 시
            // 미전송으로 검증 실패를 야기함. 토큰은 헤더로 명시 전송되므로 'lax' 로 충분 (#12260, #12179).
            cookies.set(CSRF_COOKIE_NAME, session.csrfToken, {
                path: '/',
                httpOnly: false,
                sameSite: 'lax',
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

        // 초대 플로우: 임시 소셜 계정 로그인만 완료하고 ads 초대 페이지로 복귀
        if (isInviteFlow) {
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

        redirect(302, '/register/welcome');
    }
};

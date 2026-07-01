/**
 * 탈퇴 숙려기간 중 재로그인 → 탈퇴 취소 화면 서버
 *
 * OAuth 콜백에서 숙려 상태(취소 가능)를 감지하면 단기 서명 쿠키
 * (WITHDRAWAL_GRACE_COOKIE)를 심고 이 화면으로 보낸다. 이 화면은 완전한 로그인
 * 세션 없이 동작하며, 사용자가 "탈퇴 취소"를 선택하면 백엔드
 * DELETE /api/v1/members/me/leave 로 취소 후 정상 세션을 발급한다.
 */
import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getMemberById, updateLoginTimestamp } from '$lib/server/auth/oauth/member.js';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import { generateRefreshToken, generateAccessToken } from '$lib/server/auth/jwt.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import {
    WITHDRAWAL_GRACE_COOKIE,
    verifyWithdrawalGraceToken,
    computeWithdrawalGrace,
    cancelMemberLeave
} from '$lib/server/auth/withdrawal.js';

const COOKIE_DOMAIN = env.COOKIE_DOMAIN || (dev ? undefined : '.damoang.net');

function clearGraceCookie(cookies: import('@sveltejs/kit').Cookies): void {
    cookies.delete(WITHDRAWAL_GRACE_COOKIE, {
        path: '/',
        ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
    });
}

export const load: PageServerLoad = async ({ cookies }) => {
    const token = cookies.get(WITHDRAWAL_GRACE_COOKIE);
    const mbId = token ? await verifyWithdrawalGraceToken(token) : null;
    if (!mbId) {
        redirect(302, '/login');
    }

    const member = await getMemberById(mbId);
    const grace = member ? computeWithdrawalGrace(member) : null;
    if (!member || !grace?.inGrace) {
        // 이미 확정됐거나 취소 불가(관리자 처리) → 일반 차단 화면으로
        clearGraceCookie(cookies);
        redirect(302, '/login?error=account_inactive');
    }

    return {
        nickname: member.mb_nick || member.mb_name || member.mb_id,
        leaveDate: grace.leaveDate,
        deadline: grace.deadline,
        daysRemaining: grace.daysRemaining
    };
};

export const actions: Actions = {
    // 탈퇴 취소 → 계정/데이터 복구 + 정상 로그인
    cancel: async ({ cookies, request, getClientAddress }) => {
        const token = cookies.get(WITHDRAWAL_GRACE_COOKIE);
        const mbId = token ? await verifyWithdrawalGraceToken(token) : null;
        if (!mbId) {
            return fail(401, { error: '세션이 만료되었습니다. 다시 로그인해 주세요.' });
        }

        const member = await getMemberById(mbId);
        const grace = member ? computeWithdrawalGrace(member) : null;
        if (!member || !grace?.inGrace) {
            clearGraceCookie(cookies);
            return fail(403, { error: '이미 탈퇴가 확정되어 취소할 수 없습니다.' });
        }

        const clientIp = getClientAddress();

        // 백엔드 탈퇴 취소 (DELETE /api/v1/members/me/leave)
        try {
            const accessToken = await generateAccessToken({
                mb_id: member.mb_id,
                mb_nick: member.mb_nick || member.mb_name,
                mb_level: member.mb_level ?? 0,
                mb_email: member.mb_email || ''
            });
            const result = await cancelMemberLeave(accessToken, member.mb_id, member.mb_level ?? 0);
            if (!result.ok) {
                if (result.status === 403) {
                    clearGraceCookie(cookies);
                    return fail(403, { error: '이미 탈퇴가 확정되어 취소할 수 없습니다.' });
                }
                return fail(502, {
                    error:
                        result.message ||
                        '탈퇴 취소 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
                });
            }
        } catch (err) {
            console.error('[탈퇴취소] 백엔드 호출 실패:', err);
            return fail(502, { error: '탈퇴 취소 처리 중 오류가 발생했습니다.' });
        }

        // 프론트 DB 동기화: mb_leave_date 클리어 + 로그인 시각 갱신 (자발적 탈퇴 자동 복귀)
        await updateLoginTimestamp(member.mb_id, clientIp, member.mb_leave_reason);

        // 정상 로그인 세션 발급 (OAuth 콜백과 동일 패턴)
        const session = await createSession(member.mb_id, {
            ip: clientIp,
            userAgent: request.headers.get('user-agent') || ''
        });
        const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};

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
            sameSite: 'lax',
            secure: !dev,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        const { token: refreshToken } = await generateRefreshToken(member.mb_id, {
            ip: clientIp,
            userAgent: request.headers.get('user-agent') || ''
        });
        cookies.set('refresh_token', refreshToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: 60 * 60 * 24 * 7,
            ...domainOpt
        });

        try {
            await setDamoangSSOCookie(cookies, {
                mb_id: member.mb_id,
                mb_level: member.mb_level ?? 0,
                mb_name: member.mb_name || member.mb_nick,
                mb_email: member.mb_email
            });
        } catch (e) {
            console.error('[탈퇴취소] SSO cookie 발급 실패:', e);
        }

        clearGraceCookie(cookies);
        redirect(302, '/');
    },

    // 유지 → 탈퇴 상태 그대로 두고 로그아웃 (세션 없음, 쿠키만 정리)
    keep: async ({ cookies }) => {
        clearGraceCookie(cookies);
        redirect(302, '/');
    }
};

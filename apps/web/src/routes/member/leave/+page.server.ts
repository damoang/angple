/**
 * 회원 탈퇴 신청 페이지 서버
 *
 * 탈퇴 숙려기간(30일) 모델:
 *  - 신청 시 백엔드(POST /api/v1/members/me/leave)가 계정을 비활성화하고 숙려 상태로 전환.
 *  - 신청 후 즉시 로그아웃 처리하고, 확정 예정일을 안내 페이지로 전달한다.
 */
import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
    destroySession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME
} from '$lib/server/auth/session-store.js';
import { hashToken, revokeToken } from '$lib/server/auth/token-store.js';
import { clearDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { requestMemberLeave } from '$lib/server/auth/withdrawal.js';

const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user?.id) {
        redirect(302, '/login?redirect=/member/leave');
    }
    return { mbId: locals.user.id };
};

/** 로그인 세션/쿠키 일괄 정리 (로그아웃) */
async function clearAuthCookies(
    cookies: import('@sveltejs/kit').Cookies,
    sessionId: string | undefined | null,
    refreshToken: string | undefined
): Promise<void> {
    if (sessionId) {
        await destroySession(sessionId).catch(() => {});
    }
    if (refreshToken) {
        await revokeToken(hashToken(refreshToken)).catch(() => {});
    }

    const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};
    const base = { path: '/', secure: !dev, httpOnly: true, ...domainOpt } as const;

    cookies.delete(SESSION_COOKIE_NAME, base);
    cookies.delete(CSRF_COOKIE_NAME, { ...base, httpOnly: false, sameSite: 'lax' as const });
    cookies.delete('refresh_token', base);
    cookies.delete('access_token', { ...base, httpOnly: false });
    cookies.delete('damoang_jwt', { ...base, httpOnly: false });
    cookies.delete('user_basic', { ...base, httpOnly: false });
    clearDamoangSSOCookie(cookies);
}

export const actions: Actions = {
    default: async ({ request, cookies, locals }) => {
        const mbId = locals.user?.id;
        const accessToken = locals.accessToken;
        if (!mbId || !accessToken) {
            return fail(401, { error: '로그인이 필요합니다.' });
        }

        const formData = await request.formData();
        const agreed = formData.get('agree') === 'on' || formData.get('agree') === 'true';
        if (!agreed) {
            return fail(400, { error: '탈퇴 안내에 동의해주세요.' });
        }
        const reason = ((formData.get('reason') as string) || '').trim() || undefined;

        let deadline: string | undefined;
        try {
            const result = await requestMemberLeave(
                accessToken,
                mbId,
                locals.user?.level ?? 0,
                reason
            );
            if (!result.ok) {
                return fail(result.status >= 400 && result.status < 500 ? result.status : 400, {
                    error: result.message || '탈퇴 처리에 실패했습니다.'
                });
            }
            deadline = result.deadline;
        } catch (err) {
            console.error('[회원탈퇴] 처리 에러:', err);
            return fail(500, {
                error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            });
        }

        // 탈퇴 신청 성공 → 현재 기기 로그아웃.
        //
        // ⛔ **여기서 세션·토큰 파기를 부르지 말 것.** (분쟁조정위 26R05-00197)
        //    다른 기기에 남은 세션·토큰과 web 캐시(L2)의 파기는 백엔드
        //    purgeAuthArtifacts(internal/handler/auth_artifacts.go)가 **단독으로** 맡는다.
        //    위 requestMemberLeave() 가 그 경로를 이미 태우고 돌아온 뒤다.
        //
        //    한때 여기서도 한 번 더 불렀지만 **무의미했다** — 백엔드가 먼저 DB 행을
        //    지우고 오므로 web 의 조회가 0행이 되어 캐시 키를 하나도 못 지웠다.
        //    게다가 web 과 백엔드의 CACHE_NAMESPACE 가 다를 수 있어(canary),
        //    파기 주체를 둘로 나누면 어느 쪽이 무엇을 지웠는지 추적이 불가능해진다.
        await clearAuthCookies(cookies, locals.sessionId, cookies.get('refresh_token'));

        const target = deadline
            ? `/member/leave/complete?deadline=${encodeURIComponent(deadline)}`
            : '/member/leave/complete';
        redirect(302, target);
    }
};

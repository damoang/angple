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
import { purgeAuthArtifacts } from '$lib/server/auth/purge-auth-artifacts.js';
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

        // 탈퇴 신청 성공 → 로그아웃 처리
        await clearAuthCookies(cookies, locals.sessionId, cookies.get('refresh_token'));

        // 다른 기기에 남은 세션·토큰까지 파기 — 분쟁조정위 26R05-00197 대응.
        // ⛔ clearAuthCookies 는 **현재 기기만** 정리한다(destroySession/revokeToken 모두 단건).
        //    그래서 다른 브라우저에 남은 세션이 만료 전까지 살아 있었고, 그 세션으로
        //    탈퇴 후에도 인증 상태가 유지됐다. 여기서 전량 지운다.
        // ⛔ revokeToken 은 UPDATE 라 행이 남는다 — 이 테이블들은 IP·UA 를 보유하므로
        //    purgeAuthArtifacts 의 DELETE 로 덮어 마무리한다(순서상 뒤여야 한다).
        // 백엔드 applySelfLeave 도 같은 파기를 하지만, 여기서 한 번 더 부르는 이유는
        // **web 프로세스의 L1 세션 캐시**를 함께 비우기 위해서다(Go 는 접근할 수 없다).
        await purgeAuthArtifacts(mbId);

        const target = deadline
            ? `/member/leave/complete?deadline=${encodeURIComponent(deadline)}`
            : '/member/leave/complete';
        redirect(302, target);
    }
};

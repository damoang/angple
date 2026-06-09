/**
 * 심사 전용 로그인 (review/demo login).
 *
 * damoang 은 소셜 로그인(OAuth2) 전용이라 자체 아이디/비밀번호가 없다.
 * 네이버페이 등 결제 PG/앱스토어 심사 시 심사관이 회원 전용 페이지·결제를
 * 테스트하려면 ID/PW 로그인 경로가 필요하므로, env 플래그 뒤에 임시 제공한다.
 *
 * 보안:
 * - REVIEW_LOGIN_ENABLED=1 일 때만 활성. 그 외에는 404 (라우트 자체가 없는 것처럼).
 * - 자격증명은 env(REVIEW_LOGIN_USER/REVIEW_LOGIN_PW)와 상수시간 비교.
 * - 성공 시 env(REVIEW_LOGIN_MB_ID)로 지정한 실제 g5_member 세션을 발급.
 *   (OAuth 콜백 / 일반 로그인과 동일한 세션·쿠키 스택 재사용)
 * - 심사 종료 후 REVIEW_LOGIN_ENABLED 를 끄면 즉시 비활성화된다.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import { generateRefreshToken } from '$lib/server/auth/jwt.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { getMemberById } from '$lib/server/auth/oauth/member.js';
import { issueUserBasicCookie } from '$lib/server/auth/user-basic.js';
import { checkRateLimit, recordAttempt, resetAttempts } from '$lib/server/rate-limit.js';

// 미설정 시 .damoang.net 폴백 — host-only 쿠키 시 새 탭/PWA 세션 격리 (#12260, #12179).
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '.damoang.net';

/** 심사 로그인 활성화 여부. env REVIEW_LOGIN_ENABLED=1 + 자격/계정 env 가 모두 설정돼야 한다. */
function reviewConfig(): { user: string; pw: string; mbId: string } | null {
    if (env.REVIEW_LOGIN_ENABLED !== '1') return null;
    const user = env.REVIEW_LOGIN_USER;
    const pw = env.REVIEW_LOGIN_PW;
    const mbId = env.REVIEW_LOGIN_MB_ID;
    if (!user || !pw || !mbId) return null;
    return { user, pw, mbId };
}

/** 타이밍 공격 방지 상수시간 비교. */
function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf-8');
    const bb = Buffer.from(b, 'utf-8');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
}

/** mb_image_updated_at(ISO string) → user_basic 쿠키용 Unix timestamp(number) | null. */
function toImageTs(value: string | null): number | null {
    if (!value) return null;
    const ts = Math.floor(new Date(value).getTime() / 1000);
    return Number.isFinite(ts) ? ts : null;
}

export const load: PageServerLoad = () => {
    if (!reviewConfig()) throw error(404, 'Not Found');
    return {};
};

export const actions: Actions = {
    default: async ({ request, cookies, getClientAddress }) => {
        const cfg = reviewConfig();
        if (!cfg) throw error(404, 'Not Found');

        const clientIp = getClientAddress();
        const rate = checkRateLimit(clientIp, 'review-login', 10, 15 * 60 * 1000);
        if (!rate.allowed) {
            return fail(429, { message: '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' });
        }
        recordAttempt(clientIp, 'review-login');

        const data = await request.formData();
        const username = String(data.get('username') ?? '');
        const password = String(data.get('password') ?? '');
        if (!username || !password) {
            return fail(400, { message: '아이디와 비밀번호를 입력해주세요.' });
        }

        // 두 비교 모두 수행(early-return 회피)하여 타이밍 단서를 줄인다.
        const userOk = safeEqual(username, cfg.user);
        const pwOk = safeEqual(password, cfg.pw);
        if (!userOk || !pwOk) {
            return fail(401, { message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        const member = await getMemberById(cfg.mbId);
        if (!member) {
            return fail(500, { message: '심사용 계정을 찾을 수 없습니다. 운영자에게 문의하세요.' });
        }

        resetAttempts(clientIp, 'review-login');

        // OAuth 콜백 / 일반 로그인과 동일한 세션·쿠키 스택 발급
        const session = await createSession(member.mb_id, {
            ip: clientIp,
            userAgent: request.headers.get('user-agent') || ''
        });
        const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};

        cookies.set(SESSION_COOKIE_NAME, session.sessionId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: true, // dev.damoang.net 도 CloudFront HTTPS
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });
        cookies.set(CSRF_COOKIE_NAME, session.csrfToken, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: true,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        issueUserBasicCookie(cookies, {
            id: member.mb_id,
            nickname: member.mb_nick || member.mb_name,
            mb_level: member.mb_level ?? 0,
            as_level: member.as_level ?? 0,
            mb_image: member.mb_image_url || null,
            mb_image_updated_at: toImageTs(member.mb_image_updated_at)
        });

        const { token: refreshToken } = await generateRefreshToken(member.mb_id, {
            ip: clientIp,
            userAgent: request.headers.get('user-agent') || ''
        });
        cookies.set('refresh_token', refreshToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: true,
            maxAge: 60 * 60 * 24 * 7,
            ...domainOpt
        });

        // 서브도메인 SSO (ads.damoang.net 등 Go 서비스 인증용)
        try {
            await setDamoangSSOCookie(cookies, {
                mb_id: member.mb_id,
                mb_level: member.mb_level ?? 0,
                mb_name: member.mb_name || member.mb_nick,
                mb_email: member.mb_email
            });
        } catch (e) {
            console.error('[review-login] SSO cookie 발급 실패:', e);
        }

        throw redirect(303, '/');
    }
};

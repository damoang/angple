import { json } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import { generateRefreshToken } from '$lib/server/auth/jwt.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { getMemberById } from '$lib/server/auth/oauth/member.js';
import { checkRateLimit, recordAttempt, resetAttempts } from '$lib/server/rate-limit.js';
import { checkAndPromoteMember } from '$lib/server/auth/auto-promotion.js';
import { grantLoginXP } from '$lib/server/auth/xp-grant.js';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '';

/**
 * POST /api/auth/login
 *
 * 아이디/비밀번호 로그인 프록시 + 세션 생성
 * 1. Go 백엔드에 자격 증명 검증 위임
 * 2. 성공 시 서버사이드 세션 생성
 * 3. 세션 쿠키 + CSRF 쿠키 설정
 */
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
    const clientIp = getClientAddress();

    // Rate limiting
    const rateCheck = checkRateLimit(clientIp, 'login', 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
        return json(
            { success: false, message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
            {
                status: 429,
                headers: { 'Retry-After': String(rateCheck.retryAfter || 60) }
            }
        );
    }
    recordAttempt(clientIp, 'login');

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
        return json(
            { success: false, message: '아이디와 비밀번호를 입력해주세요.' },
            { status: 400 }
        );
    }

    // Go 백엔드에 자격 증명 검증
    try {
        const backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!backendRes.ok) {
            const errorData = await backendRes.json().catch(() => ({}));
            return json(
                { success: false, message: errorData.message || '로그인에 실패했습니다.' },
                { status: backendRes.status }
            );
        }

        const result = await backendRes.json();
        const userData = result?.data;

        if (!userData?.user?.user_id) {
            return json(
                { success: false, message: '사용자 정보를 가져올 수 없습니다.' },
                { status: 500 }
            );
        }

        // 로그인 성공 → Rate limit 초기화
        resetAttempts(clientIp, 'login');

        const mbId = userData.user.user_id;

        // 서버사이드 세션 생성
        const session = await createSession(mbId, {
            ip: clientIp,
            userAgent: request.headers.get('user-agent') || ''
        });

        const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};

        // 세션 쿠키
        // 참고: dev.damoang.net은 CloudFront를 통해 HTTPS로 서빙되므로 secure: true 필요
        cookies.set(SESSION_COOKIE_NAME, session.sessionId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: true, // CloudFront HTTPS 사용
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        // CSRF 쿠키
        cookies.set(CSRF_COOKIE_NAME, session.csrfToken, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: true,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        // user_basic 쿠키 — SSR/client 공유용 최소 프로필 정보
        // /api/auth/me 호출 제거 + CDN cache key normalization 목표
        // 민감 정보(email/token) 제외, nickname/level/avatar만
        try {
            const member = await getMemberById(mbId);
            if (member) {
                const userBasic = {
                    id: member.mb_id,
                    nickname: member.mb_nick || member.mb_name,
                    mb_level: member.mb_level ?? 0,
                    as_level: member.as_level ?? 0,
                    mb_image: member.mb_image_url || null,
                    mb_image_updated_at: member.mb_image_updated_at || null
                };
                const encoded = Buffer.from(JSON.stringify(userBasic), 'utf-8').toString('base64');
                cookies.set('user_basic', encoded, {
                    path: '/',
                    httpOnly: false, // client JS 읽기 가능
                    sameSite: 'lax',
                    secure: true,
                    maxAge: SESSION_COOKIE_MAX_AGE,
                    ...domainOpt
                });
            }
        } catch {
            // user_basic 발행 실패는 로그인 성공을 막지 않음 (fallback: /api/auth/me)
        }

        // 레거시 호환: refresh_token도 생성
        const { token: refreshToken } = await generateRefreshToken(mbId, {
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

        // Go 백엔드가 설정한 refresh_token도 전달 (쿠키 동기화)
        const setCookies = backendRes.headers.getSetCookie?.() ?? [];
        for (const sc of setCookies) {
            const match = sc.match(/^refresh_token=([^;]+)/);
            if (match) {
                cookies.set('refresh_token', match[1], {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: true,
                    maxAge: 60 * 60 * 24 * 7,
                    ...domainOpt
                });
            }
        }

        // 서브도메인 SSO: damoang_jwt 쿠키 발급 (ads.damoang.net 등 Go 서비스 인증용)
        try {
            const member = await getMemberById(mbId);
            if (member) {
                await setDamoangSSOCookie(cookies, {
                    mb_id: member.mb_id,
                    mb_level: member.mb_level ?? 0,
                    mb_name: member.mb_name || member.mb_nick,
                    mb_email: member.mb_email
                });
            }
        } catch (e) {
            console.error('[Login] SSO cookie 발급 실패:', e);
        }

        // 로그인 XP 적립 후 승급 체크 (fire-and-forget, 로그인 응답 지연 방지)
        grantLoginXP(mbId)
            .then(() => checkAndPromoteMember(mbId))
            .catch((err) => {
                console.error('[Login] Login XP/promotion failed:', err);
            });

        return json({
            success: true,
            data: {
                access_token: userData.access_token,
                user: userData.user
            }
        });
    } catch (error) {
        console.error('[Login] Backend error:', error);
        return json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 502 });
    }
};

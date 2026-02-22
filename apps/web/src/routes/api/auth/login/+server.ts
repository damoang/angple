import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import {
    createSession,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_MAX_AGE
} from '$lib/server/auth/session-store.js';
import { generateRefreshToken } from '$lib/server/auth/jwt.js';
import { checkRateLimit, recordAttempt, resetAttempts } from '$lib/server/rate-limit.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '';

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
        const backendRes = await fetch(`${BACKEND_URL}/api/v2/auth/login`, {
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
        cookies.set(SESSION_COOKIE_NAME, session.sessionId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        // CSRF 쿠키
        cookies.set(CSRF_COOKIE_NAME, session.csrfToken, {
            path: '/',
            httpOnly: false,
            sameSite: 'strict',
            secure: !dev,
            maxAge: SESSION_COOKIE_MAX_AGE,
            ...domainOpt
        });

        // 레거시 호환: refresh_token도 생성
        const { token: refreshToken } = await generateRefreshToken(mbId, {
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

        // Go 백엔드가 설정한 refresh_token도 전달 (쿠키 동기화)
        const setCookies = backendRes.headers.getSetCookie?.() ?? [];
        for (const sc of setCookies) {
            const match = sc.match(/^refresh_token=([^;]+)/);
            if (match) {
                cookies.set('refresh_token', match[1], {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: !dev,
                    maxAge: 60 * 60 * 24 * 7,
                    ...domainOpt
                });
            }
        }

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

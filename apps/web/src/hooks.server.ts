import { redirect, type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { verifyToken } from '$lib/server/auth/jwt.js';
import { getMemberById } from '$lib/server/auth/oauth/member.js';
import { mapGnuboardUrl, mapRhymixUrl } from '$lib/server/url-compat.js';

/**
 * SvelteKit Server Hooks
 *
 * 1. SSR 인증: refreshToken 쿠키로 accessToken 발급 → event.locals에 저장
 *    - 1순위: SvelteKit 자체 JWT 검증 (소셜로그인으로 발급된 토큰)
 *    - 2순위: Go 백엔드 /api/v2/auth/refresh (기존 호환)
 * 2. CORS 설정: Admin 앱에서 Web API 호출 허용
 * 3. CSP 설정: XSS 및 데이터 인젝션 공격 방지
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

// CSP에 추가할 사이트별 도메인 (환경변수 기반)
const ADS_URL = import.meta.env.VITE_ADS_URL || '';
const LEGACY_URL = import.meta.env.VITE_LEGACY_URL || '';

/** SSR 인증: refreshToken 쿠키로 사용자 정보 조회 */
async function authenticateSSR(event: Parameters<Handle>[0]['event']): Promise<void> {
    event.locals.user = null;
    event.locals.accessToken = null;

    const refreshToken = event.cookies.get('refresh_token');
    if (!refreshToken) return;

    // 1순위: SvelteKit 자체 JWT 검증 (소셜로그인 토큰)
    try {
        const payload = await verifyToken(refreshToken);
        if (payload?.sub) {
            const member = await getMemberById(payload.sub);
            if (member) {
                // 자체 JWT 검증 성공 → locals 설정
                event.locals.user = {
                    nickname: member.mb_nick || member.mb_name,
                    level: member.mb_level ?? 0
                };
                event.locals.accessToken = refreshToken; // refresh_token 자체를 사용
                return;
            }
        }
    } catch {
        // SvelteKit JWT 검증 실패 → Go 백엔드 시도
    }

    // 2순위: Go 백엔드 /api/v2/auth/refresh (기존 호환)
    try {
        const refreshRes = await fetch(`${BACKEND_URL}/api/v2/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `refresh_token=${refreshToken}`
            }
        });
        if (!refreshRes.ok) return;

        const refreshData = await refreshRes.json();
        const accessToken = refreshData?.data?.access_token;
        if (!accessToken) return;

        event.locals.accessToken = accessToken;

        // 새 refreshToken 쿠키가 있으면 갱신
        const setCookies = refreshRes.headers.getSetCookie?.() ?? [];
        for (const sc of setCookies) {
            const match = sc.match(/^refresh_token=([^;]+)/);
            if (match) {
                event.cookies.set('refresh_token', match[1], {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: !dev,
                    maxAge: 60 * 60 * 24 * 7
                });
            }
        }

        // 사용자 프로필 조회
        const profileRes = await fetch(`${BACKEND_URL}/api/v2/auth/profile`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!profileRes.ok) return;

        const profileData = await profileRes.json();
        const userData = profileData?.data ?? profileData;
        event.locals.user = {
            nickname: userData?.nickname,
            level: userData?.level ?? 0
        };
    } catch {
        // 인증 실패 시 무시 (비로그인 상태)
    }
}

/** Content-Security-Policy 헤더 생성 */
function buildCsp(): string {
    // 사이트별 도메인을 CSP에 동적 추가
    const adsHost = ADS_URL ? ` ${ADS_URL}` : '';
    const legacyHost = LEGACY_URL ? ` ${LEGACY_URL}` : '';

    const directives: string[] = [
        "default-src 'self'",
        // SvelteKit + GAM(GPT) + AdSense + Turnstile 스크립트 허용
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com${adsHost} https://www.googletagservices.com https://adservice.google.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google`,
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com${adsHost}`,
        "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        // API 및 광고 서버 연결 허용
        `connect-src 'self' http://localhost:* ws://localhost:*${legacyHost}${adsHost} https://pagead2.googlesyndication.com https://securepubads.g.doubleclick.net https://www.google-analytics.com https://cdn.jsdelivr.net https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://*.gstatic.com`,
        // YouTube, Google 광고, Turnstile iframe 허용
        "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://googleads.g.doubleclick.net https://securepubads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://*.googlesyndication.com https://*.doubleclick.net",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self' https://appleid.apple.com"
    ];

    return directives.join('; ');
}

const cspHeader = buildCsp();

export const handle: Handle = async ({ event, resolve }) => {
    // 그누보드/라이믹스 URL 호환 리다이렉트 (SEO 보존)
    const { pathname } = event.url;
    if (pathname.startsWith('/bbs/')) {
        const redirectUrl = mapGnuboardUrl(pathname, event.url.searchParams);
        if (redirectUrl) {
            redirect(301, redirectUrl);
        }
    }
    if (pathname === '/index.php' && event.url.searchParams.has('mid')) {
        const redirectUrl = mapRhymixUrl(pathname, event.url.searchParams);
        if (redirectUrl) {
            redirect(301, redirectUrl);
        }
    }

    // SSR 인증
    await authenticateSSR(event);

    // OPTIONS 요청 (CORS preflight) 처리
    if (event.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // /api/plugins/* 프록시는 더 이상 사용하지 않음
    // 모든 /api/plugins/* 요청은 SvelteKit API 라우트에서 처리

    const response = await resolve(event);

    // CORS 헤더
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 보안 헤더
    if (!dev) {
        response.headers.set('Content-Security-Policy', cspHeader);
    }
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return response;
};

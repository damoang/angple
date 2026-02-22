import { redirect, type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getMemberById } from '$lib/server/auth/oauth/member.js';
import { getSession, SESSION_COOKIE_NAME } from '$lib/server/auth/session-store.js';
import { checkRateLimit, recordAttempt } from '$lib/server/rate-limit.js';
import { mapGnuboardUrl, mapRhymixUrl } from '$lib/server/url-compat.js';

/**
 * SvelteKit Server Hooks
 *
 * 1. SSR 인증: angple_sid 세션 쿠키 → 세션 스토어 조회 (세션 기반 only, JWT 미사용)
 * 2. Rate limiting: 인증 관련 엔드포인트 보호
 * 3. CSRF: 세션 기반 double-submit cookie 검증
 * 4. CORS 설정: Admin 앱에서 Web API 호출 허용
 * 5. CSP 설정: XSS 및 데이터 인젝션 공격 방지
 */

// 쿠키 도메인: 서브도메인 간 공유 (예: ".damoang.net")
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '';

// CSP에 추가할 사이트별 도메인 (런타임 환경변수)
const ADS_URL = process.env.ADS_URL || '';
const LEGACY_URL = process.env.LEGACY_URL || '';

/** Rate limiting 경로 패턴 */
const RATE_LIMITED_PATHS = [
    { path: '/api/v2/auth/login', action: 'login', maxAttempts: 10, windowMs: 15 * 60 * 1000 },
    {
        path: '/plugin/social/start',
        action: 'oauth_start',
        maxAttempts: 20,
        windowMs: 15 * 60 * 1000
    },
    { path: '/api/auth/logout', action: 'logout', maxAttempts: 30, windowMs: 15 * 60 * 1000 }
];

/** CSRF 검증이 필요한 mutating 메서드 */
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** CSRF 검증에서 제외할 경로 */
const CSRF_EXEMPT_PATHS = [
    '/plugin/social/', // OAuth 콜백 (프로바이더가 POST)
    '/api/v2/', // Go 백엔드 프록시 (자체 인증 사용)
    '/api/auth/login', // 로그인 (세션 생성 전이므로 CSRF 토큰 없음)
    '/api/auth/logout' // 로그아웃 (쿠키 삭제만 하므로 위험도 낮음)
];

/** SSR 인증: 서버사이드 세션 only (JWT 미사용) */
async function authenticateSSR(event: Parameters<Handle>[0]['event']): Promise<void> {
    event.locals.user = null;
    event.locals.accessToken = null;
    event.locals.sessionId = null;
    event.locals.csrfToken = null;

    // 세션 쿠키로 인증
    const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
    if (sessionId) {
        try {
            const session = await getSession(sessionId);
            if (session) {
                const member = await getMemberById(session.mbId);
                if (member) {
                    event.locals.user = {
                        nickname: member.mb_nick || member.mb_name,
                        level: member.mb_level ?? 0
                    };
                    event.locals.sessionId = sessionId;
                    event.locals.csrfToken = session.csrfToken;
                    // Go 백엔드 통신용 내부 JWT 생성 (브라우저 노출 없음)
                    const { generateAccessToken } = await import('$lib/server/auth/jwt.js');
                    event.locals.accessToken = await generateAccessToken(member);
                    return;
                }
            }
        } catch {
            // 세션 조회 실패
        }
    }

    // 세션 없으면 잔여 JWT 쿠키 정리 (로그아웃 후 도메인 불일치로 남은 쿠키)
    const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};
    const cleanupOpts = { path: '/', secure: !dev, httpOnly: true, ...domainOpt } as const;
    const staleNames = ['refresh_token', 'damoang_jwt', 'access_token'];
    for (const name of staleNames) {
        if (event.cookies.get(name)) {
            try {
                event.cookies.delete(name, cleanupOpts);
            } catch {
                // 쿠키 삭제 실패 무시
            }
        }
    }
}

/** Content-Security-Policy 헤더 생성 */
function buildCsp(): string {
    // 사이트별 도메인을 CSP에 동적 추가
    const adsHost = ADS_URL ? ` ${ADS_URL}` : '';
    const legacyHost = LEGACY_URL ? ` ${LEGACY_URL}` : '';

    const directives: string[] = [
        "default-src 'self' https://damoang.net https://*.damoang.net",
        // SvelteKit + GAM(GPT) + AdSense + Turnstile 스크립트 허용
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://securepubads.g.doubleclick.net https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com${adsHost} https://www.googletagservices.com https://www.googletagmanager.com https://adservice.google.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google`,
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com${adsHost}`,
        "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        // API 및 광고 서버 연결 허용
        `connect-src 'self' http://localhost:* ws://localhost:* https://*.damoang.net https://damoang.net${legacyHost}${adsHost} https://pagead2.googlesyndication.com https://securepubads.g.doubleclick.net https://www.google-analytics.com https://cdn.jsdelivr.net https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://*.gstatic.com`,
        // YouTube, 임베드 플랫폼, Google 광고, Turnstile iframe 허용
        "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://platform.twitter.com https://player.vimeo.com https://clips.twitch.tv https://player.twitch.tv https://www.tiktok.com https://www.instagram.com https://googleads.g.doubleclick.net https://securepubads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google",
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

    // Rate limiting: 인증 관련 엔드포인트 보호
    const rateLimitRule = RATE_LIMITED_PATHS.find((r) => pathname.startsWith(r.path));
    if (rateLimitRule) {
        const clientIp = event.getClientAddress();
        const { allowed, retryAfter } = checkRateLimit(
            clientIp,
            rateLimitRule.action,
            rateLimitRule.maxAttempts,
            rateLimitRule.windowMs
        );
        if (!allowed) {
            return new Response(
                JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(retryAfter || 60)
                    }
                }
            );
        }
        recordAttempt(clientIp, rateLimitRule.action);
    }

    // SSR 인증
    await authenticateSSR(event);

    // CSRF 검증: 세션 기반 double-submit cookie
    if (
        event.locals.sessionId &&
        CSRF_METHODS.has(event.request.method) &&
        !CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p))
    ) {
        const csrfHeader = event.request.headers.get('x-csrf-token');
        if (csrfHeader !== event.locals.csrfToken) {
            return new Response(JSON.stringify({ error: 'CSRF 토큰이 유효하지 않습니다.' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

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
    response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSRF-Token'
    );

    // 보안 헤더
    if (!dev) {
        response.headers.set('Content-Security-Policy', cspHeader);
    }
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // 캐시 제어: 인증 데이터(user, accessToken)가 레이아웃에 포함되므로
    // 모든 HTML/__data.json 응답은 사용자별로 고유 → 절대 캐시 금지
    response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    response.headers.set('Vary', 'Cookie');

    return response;
};

import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getMemberById } from '$lib/server/auth/oauth/member.js';
import { getSession, SESSION_COOKIE_NAME } from '$lib/server/auth/session-store.js';
import { generateAccessToken } from '$lib/server/auth/jwt.js';
import { checkRateLimit, recordAttempt } from '$lib/server/rate-limit.js';
import { mapGnuboardUrl, mapRhymixUrl } from '$lib/server/url-compat.js';

// --- JWT 인메모리 캐시 (세션별, 5분 TTL) ---
const jwtCache = new Map<string, { token: string; expiry: number }>();
const JWT_CACHE_TTL = 5 * 60 * 1000; // 5분
const MAX_JWT_CACHE_SIZE = 5000;

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
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '';

// CSP에 추가할 사이트별 도메인 (런타임 환경변수)
const ADS_URL = env.ADS_URL || '';
const LEGACY_URL = env.LEGACY_URL || '';

/** CDN 캐시 가능한 공개 경로 (비로그인 시만 적용) */
const PUBLIC_CACHEABLE_PATHS = ['/feed', '/game', '/info'];

function isPublicCacheablePath(pathname: string): boolean {
    return PUBLIC_CACHEABLE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Rate limiting 경로 패턴 */
const RATE_LIMITED_PATHS = [
    { path: '/api/v1/auth/login', action: 'login', maxAttempts: 10, windowMs: 15 * 60 * 1000 },
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
    '/api/' // SvelteKit 내부 API 라우트 (same-origin, SvelteKit Origin 검증으로 보호)
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
                        id: member.mb_id,
                        nickname: member.mb_nick || member.mb_name,
                        level: member.mb_level ?? 0
                    };
                    event.locals.sessionId = sessionId;
                    event.locals.csrfToken = session.csrfToken;

                    // Go 백엔드 통신용 내부 JWT (캐시 사용, 5분 TTL)
                    const now = Date.now();
                    const cachedJwt = jwtCache.get(session.mbId);
                    if (cachedJwt && now < cachedJwt.expiry) {
                        event.locals.accessToken = cachedJwt.token;
                    } else {
                        const token = await generateAccessToken(member);
                        event.locals.accessToken = token;
                        // 캐시 크기 제한
                        if (jwtCache.size > MAX_JWT_CACHE_SIZE) {
                            for (const [key, entry] of jwtCache) {
                                if (now >= entry.expiry) jwtCache.delete(key);
                            }
                        }
                        jwtCache.set(session.mbId, { token, expiry: now + JWT_CACHE_TTL });
                    }
                    return;
                }
            }
        } catch (err) {
            console.error('[Auth] 세션 인증 실패:', err instanceof Error ? err.message : err);
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
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://securepubads.g.doubleclick.net https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com${adsHost} https://www.googletagservices.com https://www.googletagmanager.com https://adservice.google.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google https://cdn.ampproject.org`,
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com${adsHost}`,
        "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        // API 및 광고 서버 연결 허용
        `connect-src 'self' http://localhost:* ws://localhost:* https://*.damoang.net https://damoang.net${legacyHost}${adsHost} https://pagead2.googlesyndication.com https://securepubads.g.doubleclick.net https://www.google-analytics.com https://cdn.jsdelivr.net https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://*.gstatic.com https://cdn.ampproject.org`,
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
        const origin = event.request.headers.get('origin');
        const headers: Record<string, string> = {
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
            'Access-Control-Max-Age': '86400'
        };
        // credentials: include 지원을 위해 구체적인 origin 사용
        if (origin) {
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Credentials'] = 'true';
        } else {
            headers['Access-Control-Allow-Origin'] = '*';
        }
        return new Response(null, { headers });
    }

    // /api/plugins/* 프록시는 더 이상 사용하지 않음
    // 모든 /api/plugins/* 요청은 SvelteKit API 라우트에서 처리

    // SSR 다크모드: 쿠키에서 테마 읽어 <html> 클래스 주입 (FOUC 방지)
    const themeMode = event.cookies.get('angple_theme_mode') || '';
    const htmlClass = themeMode === 'dark' ? 'dark' : themeMode === 'amoled' ? 'amoled' : '';

    // SSR 밀도: 쿠키에서 읽어 CSS 변수 주입 (레이아웃 flash 방지)
    const density = event.cookies.get('angple_ui_density') || 'balanced';
    const dPad = density === 'compact' ? '0px' : density === 'relaxed' ? '6px' : '3px';

    const response = await resolve(event, {
        transformPageChunk: ({ html }) => {
            const cls = htmlClass ? ` class="${htmlClass}"` : '';
            const sty = ` style="--row-pad-extra:${dPad};--comment-pad-extra:${dPad}"`;
            return html.replace('<html lang="ko">', `<html lang="ko"${cls}${sty}>`);
        }
    });

    // CORS 헤더 (credentials: include 지원)
    const origin = event.request.headers.get('origin');
    if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else {
        response.headers.set('Access-Control-Allow-Origin', '*');
    }
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

    // 캐시 제어:
    // - _app/immutable/ → SvelteKit 기본 장기 캐시 유지 (content-hash)
    // - 비로그인 + 공개 페이지 → CDN stale-while-revalidate (ISR-like)
    // - 나머지 → 캐시 금지 (인증 데이터 포함)
    if (event.url.pathname.startsWith('/_app/immutable')) {
        // SvelteKit이 이미 설정 → 그대로 유지
    } else if (!event.locals.user && isPublicCacheablePath(pathname)) {
        // 비로그인 사용자의 공개 페이지: CDN 캐시 30초, stale 60초
        response.headers.set(
            'Cache-Control',
            'public, s-maxage=30, stale-while-revalidate=60, max-age=0'
        );
        response.headers.set('Vary', 'Cookie');
    } else {
        response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
        response.headers.set('Vary', 'Cookie');
    }

    return response;
};

/**
 * 서버 에러 핸들러 — 에러 추적 및 사용자 친화적 메시지 반환
 * 404 제외한 모든 에러를 Dantry(ClickHouse 기반)로 fire-and-forget 전송
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
    const err = error instanceof Error ? error : new Error(String(error));

    if (status !== 404) {
        console.error(`[Server Error] ${status} ${event.url.pathname}:`, err.message);

        // Fire-and-forget: Dantry 에러 트래커로 전송
        if (ADS_URL) {
            fetch(`${ADS_URL}/api/v1/dantry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'server_error',
                    status,
                    message: err.message,
                    stack: err.stack?.slice(0, 2000),
                    url: event.url.href,
                    timestamp: new Date().toISOString()
                }),
                signal: AbortSignal.timeout(3_000)
            }).catch(() => {});
        }
    }

    return {
        message: status >= 500 ? '일시적인 오류가 발생했습니다.' : message
    };
};

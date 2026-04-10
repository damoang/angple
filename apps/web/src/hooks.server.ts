import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getMemberById, updateLoginTimestamp } from '$lib/server/auth/oauth/member.js';
import { getSession, SESSION_COOKIE_NAME } from '$lib/server/auth/session-store.js';
import { grantLoginXP } from '$lib/server/auth/xp-grant.js';
import { grantLoginPoint } from '$lib/server/auth/point-grant.js';
import { checkAndPromoteMember } from '$lib/server/auth/auto-promotion.js';
import { generateAccessToken } from '$lib/server/auth/jwt.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';
import { checkRateLimit, recordAttempt } from '$lib/server/rate-limit.js';
import { mapGnuboardUrl, mapRhymixUrl } from '$lib/server/url-compat.js';

// --- 환경별 접근 제어 (hostname → 환경변수 매핑) ---
// 각 환경변수가 설정된 경우에만 해당 호스트에서 접근 제어 활성화
const ACCESS_CONTROL_MAP: Record<string, string[] | null> = {
    'canary.damoang.net': env.CANARY_ALLOWED_MEMBERS
        ? env.CANARY_ALLOWED_MEMBERS.split(',').map((s) => s.trim())
        : null,
    'dev.damoang.net': env.DEV_ALLOWED_MEMBERS
        ? env.DEV_ALLOWED_MEMBERS.split(',').map((s) => s.trim())
        : null
};

/** JWT 페이로드 파싱 (서명 검증 없이 - 접근 제어용 간단 체크) */
function parseJWTPayload(token: string): { mb_id?: string } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload;
    } catch {
        return null;
    }
}

// --- JWT 인메모리 캐시 (세션별, 5분 TTL) ---
const jwtCache = new Map<string, { token: string; expiry: number }>();
const JWT_CACHE_TTL = 5 * 60 * 1000; // 5분
const MAX_JWT_CACHE_SIZE = 50000;

// --- SSR 응답 캐시 (비로그인: 홈 + 게시판 목록 + 글 상세) ---
import {
    ssrCache,
    ssrCachePending,
    SSR_CACHE_TTL_HOME,
    SSR_CACHE_TTL_BOARD,
    SSR_CACHE_TTL_POST,
    MAX_SSR_CACHE_SIZE
} from '$lib/server/ssr-cache.js';

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

// CORS 허용 origin (credentials 포함 요청만 제한)
function isAllowedOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        const host = url.hostname;
        // 같은 사이트 + 서브도메인 허용
        if (
            host === 'damoang.net' ||
            host.endsWith('.damoang.net') ||
            host === 'localhost' ||
            host === '127.0.0.1'
        ) {
            return true;
        }
        // 환경변수로 추가 origin 허용
        const extra = env.ALLOWED_ORIGINS?.split(',').map((s: string) => s.trim()) || [];
        return extra.includes(origin);
    } catch {
        return false;
    }
}

// CSP에 추가할 사이트별 도메인 (런타임 환경변수)
const ADS_URL = env.ADS_URL || '';
const LEGACY_URL = env.LEGACY_URL || '';
const ASSET_BASE_URL = (env.ASSET_BASE_URL || '').replace(/\/+$/, '');

/** CDN 캐시 가능한 공개 경로 (비로그인 시만 적용) */
const PUBLIC_CACHEABLE_PATHS = ['/feed', '/games', '/info'];

/** 게시판 목록 패턴: /free, /tips, /qa 등 (1-depth, 영문+숫자+하이픈) */
const BOARD_PATH_REGEX = /^\/[a-z][a-z0-9_-]{1,20}$/;

/** 게시판이 아닌 1-depth 경로 (기존 라우트와 충돌 방지) */
const NON_BOARD_PATHS = new Set([
    '/admin',
    '/auth',
    '/login',
    '/logout',
    '/register',
    '/signup',
    '/search',
    '/settings',
    '/profile',
    '/api',
    '/feed',
    '/games',
    '/info',
    '/about',
    '/contact',
    '/plugin',
    '/themes',
    '/install',
    '/healthz',
    '/manifest',
    '/robots',
    '/sitemap',
    '/sw'
]);

const ROOT_ALIAS_REDIRECTS: Record<string, string> = {
    '/apple-touch-icon.png': '/icons/icon-192.png',
    '/apple-touch-iconpng': '/icons/icon-192.png',
    '/apple-touch-icon-precomposed.png': '/icons/icon-192.png',
    '/apple-touch-icon-precomposedpng': '/icons/icon-192.png',
    '/apple-touch-icon-120x120.png': '/icons/icon-192.png',
    '/apple-touch-icon-120x120png': '/icons/icon-192.png',
    '/apple-touch-icon-120x120-precomposed.png': '/icons/icon-192.png',
    '/apple-touch-icon-120x120-precomposedpng': '/icons/icon-192.png',
    '/apple-touch-icon-152x152.png': '/icons/icon-192.png',
    '/apple-touch-icon-152x152png': '/icons/icon-192.png',
    '/apple-touch-icon-152x152-precomposed.png': '/icons/icon-192.png',
    '/apple-touch-icon-152x152-precomposedpng': '/icons/icon-192.png',
    '/site.webmanifest': '/manifest.json',
    '/sitewebmanifest': '/manifest.json',
    '/indexphp': '/'
};

const CDN_MEDIA_BASE_URL = (env.CDN_URL || env.VITE_S3_URL || '').replace(/\/+$/, '');

function isMalformedExternalImagePath(pathname: string): boolean {
    if (!pathname.startsWith('/http')) return false;
    if (pathname.includes('/', 1)) return false;
    return /(avif|gif|jpe?g|png|webp)$/i.test(pathname);
}

function isLegacyMediaPath(pathname: string): boolean {
    return pathname === '/data' || pathname.startsWith('/data/');
}

function isPublicCacheablePath(pathname: string): boolean {
    return PUBLIC_CACHEABLE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isBoardListPath(pathname: string, searchParams: URLSearchParams): boolean {
    if (!BOARD_PATH_REGEX.test(pathname)) return false;
    if (NON_BOARD_PATHS.has(pathname)) return false;
    // 검색 파라미터 있으면 캐시 안 함 (개인화 가능성)
    if (searchParams.has('sfl') || searchParams.has('stx') || searchParams.has('tag')) return false;
    return true;
}

/** 글 상세 페이지 패턴: /boardId/postId (숫자) */
const POST_DETAIL_REGEX = /^\/[a-z][a-z0-9_-]{1,20}\/\d+$/;
function isPostDetailPath(pathname: string): boolean {
    return POST_DETAIL_REGEX.test(pathname);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendImmutableAssetCacheBust(html: string, cacheBust: string): string {
    if (!cacheBust) return html;

    const encoded = encodeURIComponent(cacheBust);
    const patterns = [
        ASSET_BASE_URL
            ? new RegExp(
                  `(${escapeRegExp(ASSET_BASE_URL)}/_app/immutable/[^"'()\\s?]+)(?=(["')]))`,
                  'g'
              )
            : null,
        /((?:\.\/|\/)?_app\/immutable\/[^"'()\s?]+)(?=(["')]))/g
    ].filter((pattern): pattern is RegExp => pattern instanceof RegExp);

    let nextHtml = html;
    for (const pattern of patterns) {
        nextHtml = nextHtml.replace(pattern, `$1?_v=${encoded}`);
    }
    return nextHtml;
}

function rewriteImmutableAssetUrls(html: string, cacheBust = ''): string {
    let nextHtml = html;
    if (ASSET_BASE_URL) {
        nextHtml = nextHtml.replace(
            /(["'(])(?:\.\/|\/)?_app\/immutable\//g,
            `$1${ASSET_BASE_URL}/_app/immutable/`
        );
    }
    return appendImmutableAssetCacheBust(nextHtml, cacheBust);
}

/**
 * 스벨트내부 데이터 요청인지 구분
 * @param event
 * @returns
 */
function isSvelteKitDataRequest(event: Parameters<Handle>[0]['event']): boolean {
    return (
        event.isDataRequest ||
        event.url.pathname.endsWith('/__data.json') ||
        event.request.headers.has('x-sveltekit-invalidated')
    );
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
    '/api/', // SvelteKit 내부 API 라우트 (same-origin, SvelteKit Origin 검증으로 보호)
    '/cert/inicis/result' // KG이니시스 인증 콜백 (외부 POST)
];

/**
 * 클라이언트 IP 안전 조회
 *
 * adapter-node에서 ADDRESS_HEADER(x-real-ip)가 설정된 경우,
 * SSR 내부 fetch(svelteKitFetch)로 호출된 요청에는 해당 헤더가 없어
 * getClientAddress()가 throw합니다. 이 헬퍼로 통일하면
 * 향후 getClientAddress() 호출 추가 시에도 같은 문제를 방지합니다.
 */
function safeGetClientAddress(event: Parameters<Handle>[0]['event']): string | null {
    try {
        return event.getClientAddress();
    } catch {
        return null;
    }
}

function getGlobalApiRateLimitKey(
    event: Parameters<Handle>[0]['event'],
    isWrite: boolean
): string | null {
    if (isWrite) {
        const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
        if (sessionId) return `sid:${sessionId}`;
    }
    const clientIp = safeGetClientAddress(event);
    return clientIp ? `ip:${clientIp}` : null;
}

/** 타임아웃 래퍼: 지정 시간 내 미완료 시 null 반환 */
const AUTH_TIMEOUT_MS = 3000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
    ]);
}

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
            const session = await withTimeout(getSession(sessionId), AUTH_TIMEOUT_MS);
            if (session) {
                const member = await withTimeout(getMemberById(session.mbId), AUTH_TIMEOUT_MS);
                if (member) {
                    event.locals.user = {
                        id: member.mb_id,
                        nickname: member.mb_nick || member.mb_name,
                        level: member.mb_level ?? 0,
                        as_level: member.as_level ?? 0,
                        mb_certify: member.mb_certify || '',
                        mb_image: member.mb_image_url || undefined,
                        mb_image_updated_at: member.mb_image_updated_at || undefined,
                        advertiser_end_date: member.advertiser_end_date || undefined,
                        advertiser_status: member.advertiser_status || undefined
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
                        // 캐시 크기 제한: 만료 항목만 정리 (O(n) 랜덤 삭제 → 정밀 eviction)
                        if (jwtCache.size >= MAX_JWT_CACHE_SIZE) {
                            for (const [key, entry] of jwtCache) {
                                if (now >= entry.expiry) jwtCache.delete(key);
                            }
                            // 만료 정리 후에도 초과면 가장 오래된 10% 제거
                            if (jwtCache.size >= MAX_JWT_CACHE_SIZE) {
                                const evictCount = Math.floor(MAX_JWT_CACHE_SIZE * 0.1);
                                let removed = 0;
                                for (const key of jwtCache.keys()) {
                                    if (removed >= evictCount) break;
                                    jwtCache.delete(key);
                                    removed++;
                                }
                            }
                        }
                        jwtCache.set(session.mbId, { token, expiry: now + JWT_CACHE_TTL });
                    }

                    // 일일 로그인 갱신: mb_today_login이 오늘이 아니면 업데이트 + XP/포인트/승급
                    // 페이지 네비게이션 요청에서만 실행 (API/데이터 요청 제외)
                    if (!event.url.pathname.startsWith('/api/') && !isSvelteKitDataRequest(event)) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const raw = member.mb_today_login;
                        const lastLogin =
                            raw && typeof raw === 'string' ? raw.split(' ')[0].split('T')[0] : '';
                        if (lastLogin !== todayStr) {
                            const clientIp = safeGetClientAddress(event) || '';
                            // fire-and-forget: 응답 지연 방지
                            void (async () => {
                                try {
                                    await updateLoginTimestamp(member.mb_id, clientIp);
                                    await Promise.allSettled([
                                        grantLoginXP(member.mb_id),
                                        grantLoginPoint(member.mb_id)
                                    ]);
                                    await checkAndPromoteMember(member.mb_id);
                                } catch {
                                    // 로그인 갱신 실패는 무시
                                }
                            })();
                        }
                    }

                    // 서브도메인 SSO: damoang_jwt 쿠키 자동 갱신
                    // 페이지 네비게이션 요청에서만 실행 (API 요청 제외)
                    // ⚡ 비동기 non-blocking: 응답 지연 방지
                    if (!event.url.pathname.startsWith('/api/')) {
                        try {
                            const existingJwt = event.cookies.get('damoang_jwt');
                            let needsRenewal = !existingJwt;

                            if (existingJwt && !needsRenewal) {
                                // JWT 만료 10분 이내면 갱신 (base64 페이로드만 읽기)
                                const parts = existingJwt.split('.');
                                if (parts.length === 3) {
                                    const payload = JSON.parse(
                                        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
                                    );
                                    if (payload.exp && payload.exp - now / 1000 < 600) {
                                        needsRenewal = true;
                                    }
                                }
                            }

                            if (needsRenewal) {
                                // fire-and-forget: 응답을 기다리지 않음
                                void setDamoangSSOCookie(event.cookies, {
                                    mb_id: member.mb_id,
                                    mb_level: member.mb_level ?? 0,
                                    mb_name: member.mb_name || member.mb_nick,
                                    mb_email: member.mb_email
                                }).catch(() => {});
                            }
                        } catch {
                            // SSO 쿠키 갱신 실패는 무시 (메인 인증에 영향 없음)
                        }
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
    const assetOrigin = ASSET_BASE_URL ? ` ${new URL(ASSET_BASE_URL).origin}` : '';

    const directives: string[] = [
        "default-src 'self' https://damoang.net https://*.damoang.net",
        // SvelteKit + GAM(GPT) + AdSense + Turnstile 스크립트 허용
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://securepubads.g.doubleclick.net https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com${adsHost}${assetOrigin} https://www.googletagservices.com https://www.googletagmanager.com https://adservice.google.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google https://cdn.ampproject.org https://platform.twitter.com https://www.instagram.com https://www.tiktok.com https://embed.bsky.app https://t1.daumcdn.net`,
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com${adsHost}${assetOrigin}`,
        `font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com${assetOrigin}`,
        `img-src 'self' data: blob: https:${assetOrigin}`,
        "worker-src 'self' blob:",
        // API 및 광고 서버 연결 허용
        `connect-src 'self' http://localhost:* ws://localhost:* https://*.damoang.net https://damoang.net${legacyHost}${adsHost}${assetOrigin} https://pagead2.googlesyndication.com https://securepubads.g.doubleclick.net https://www.google-analytics.com https://cdn.jsdelivr.net https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://*.gstatic.com https://cdn.ampproject.org https://t1.daumcdn.net`,
        // YouTube, 임베드 플랫폼, Google 광고, Turnstile iframe 허용
        "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://platform.twitter.com https://player.vimeo.com https://clips.twitch.tv https://player.twitch.tv https://www.tiktok.com https://www.instagram.com https://www.redditmedia.com https://embed.bsky.app https://googleads.g.doubleclick.net https://securepubads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self' https://appleid.apple.com https://sa.inicis.com"
    ];

    return directives.join('; ');
}

const cspHeader = buildCsp();

/** 개발/내부 전용 경로 — 프로덕션에서 차단 */
const DEV_ONLY_PATHS = ['/api-test', '/api-docs', '/api-doc', '/install'];

/** 글로벌 API rate limiting (IP당 요청 수) */
const GLOBAL_API_RATE = { maxRequests: 600, windowMs: 60_000 }; // 분당 600회 (페이지당 ~10 API 호출)
const WRITE_API_RATE = { maxRequests: 60, windowMs: 60_000 }; // 쓰기 분당 60회

export const handle: Handle = async ({ event, resolve }) => {
    const { pathname } = event.url;
    const isDataRequest = isSvelteKitDataRequest(event);

    if (isMalformedExternalImagePath(pathname)) {
        return new Response(null, {
            status: 204,
            headers: {
                'cache-control': 'public, max-age=86400, s-maxage=86400'
            }
        });
    }

    if (CDN_MEDIA_BASE_URL && isLegacyMediaPath(pathname)) {
        throw redirect(301, `${CDN_MEDIA_BASE_URL}${pathname}${event.url.search}`);
    }

    // --- 환경별 접근 제어 (hostname 기반) ---
    // 로그인 관련 경로는 접근 제어 제외 (무한 리다이렉트 방지)
    const ACCESS_CONTROL_BYPASS = ['/login', '/auth', '/api/auth'];
    const allowedMembers = ACCESS_CONTROL_MAP[event.url.hostname];
    if (
        allowedMembers &&
        !ACCESS_CONTROL_BYPASS.some((p) => pathname === p || pathname.startsWith(p + '/'))
    ) {
        const jwt = event.cookies.get('damoang_jwt');

        if (!jwt) {
            // 로그인 페이지로 리다이렉트 (같은 호스트로 — 운영으로 보내면 무한 루프)
            const loginUrl = `${event.url.origin}/login?redirect=${encodeURIComponent(event.url.href)}`;
            return new Response(null, {
                status: 302,
                headers: { Location: loginUrl }
            });
        }

        const payload = parseJWTPayload(jwt);
        if (!payload?.mb_id || !allowedMembers.includes(payload.mb_id)) {
            return new Response('접근 권한이 없습니다. 허용된 테스터만 접근할 수 있습니다.', {
                status: 403,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
    }

    // 개발/내부 전용 경로 차단 (프로덕션)
    if (!dev && DEV_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
        return new Response('Not Found', { status: 404 });
    }

    // 글로벌 API Rate Limiting (SSR 내부 fetch는 IP 없으므로 건너뜀)
    if (pathname.startsWith('/api/')) {
        const isWrite = event.request.method !== 'GET' && event.request.method !== 'HEAD';
        const rate = isWrite ? WRITE_API_RATE : GLOBAL_API_RATE;
        const action = isWrite ? 'api_write' : 'api_read';
        const rateLimitKey = getGlobalApiRateLimitKey(event, isWrite);
        if (rateLimitKey) {
            const { allowed, retryAfter } = checkRateLimit(
                rateLimitKey,
                action,
                rate.maxRequests,
                rate.windowMs
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
            recordAttempt(rateLimitKey, action);
        }
    }

    // 그누보드/라이믹스 URL 호환 리다이렉트 (SEO 보존)
    const rootAliasRedirect = ROOT_ALIAS_REDIRECTS[pathname];
    if (rootAliasRedirect) {
        throw redirect(301, rootAliasRedirect);
    }

    if (pathname.startsWith('/bbs/')) {
        const redirectUrl = mapGnuboardUrl(pathname, event.url.searchParams);
        if (redirectUrl) {
            throw redirect(301, redirectUrl);
        }
    }
    if (pathname === '/index.php' && event.url.searchParams.has('mid')) {
        const redirectUrl = mapRhymixUrl(pathname, event.url.searchParams);
        if (redirectUrl) {
            throw redirect(301, redirectUrl);
        }
    }

    // Rate limiting: 인증 관련 엔드포인트 보호 (SSR 내부 fetch는 IP 없으므로 건너뜀)
    const rateLimitRule = RATE_LIMITED_PATHS.find((r) => pathname.startsWith(r.path));
    if (rateLimitRule) {
        const clientIp = safeGetClientAddress(event);
        if (clientIp) {
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
        let csrfFormValue: string | null = null;
        const contentType = event.request.headers.get('content-type') || '';
        if (
            contentType.includes('application/x-www-form-urlencoded') ||
            contentType.includes('multipart/form-data')
        ) {
            try {
                const formData = await event.request.clone().formData();
                csrfFormValue = String(formData.get('_csrf') || '');
            } catch {
                csrfFormValue = null;
            }
        }
        if (csrfHeader !== event.locals.csrfToken && csrfFormValue !== event.locals.csrfToken) {
            return new Response(JSON.stringify({ error: 'CSRF 토큰이 유효하지 않습니다.' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    const publicHtmlCacheControl = 'public, s-maxage=30, stale-while-revalidate=60, max-age=0';

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

    // --- 비로그인 SSR 응답 캐시 (홈 + 게시판 목록 + 글 상세) ---
    // Pod 재시작 시 캐시 자동 소멸 → 배포 시 구 JS 경로 문제 없음
    const isHomePage = pathname === '/';
    const isBoardList = isBoardListPath(pathname, event.url.searchParams);
    const isPostDetail = isPostDetailPath(pathname);
    const hasSessionCookie =
        !!event.cookies.get(SESSION_COOKIE_NAME) || !!event.cookies.get('damoang_jwt');
    const assetRecoveryBust = event.url.searchParams.get('_v') || '';
    const bypassSsrCacheForRecovery = assetRecoveryBust.length > 0;
    const isAnonymousPublicHtml =
        !hasSessionCookie &&
        !bypassSsrCacheForRecovery &&
        (isHomePage || isBoardList || isPostDetail);
    if (!isDataRequest && isAnonymousPublicHtml) {
        const cacheKey = isHomePage ? '/' : pathname;
        const cacheTtl = isHomePage
            ? SSR_CACHE_TTL_HOME
            : isPostDetail
              ? SSR_CACHE_TTL_POST
              : SSR_CACHE_TTL_BOARD;

        const cached = ssrCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTtl) {
            return new Response(cached.body, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': publicHtmlCacheControl,
                    'X-Content-Type-Options': 'nosniff',
                    'X-Frame-Options': 'SAMEORIGIN',
                    'Referrer-Policy': 'strict-origin-when-cross-origin',
                    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
                    ...(!dev ? { 'Content-Security-Policy': cspHeader } : {}),
                    'X-SSR-Cache': 'HIT'
                }
            });
        }

        // Singleflight: 동시 요청 시 1개만 SSR 실행
        const pending = ssrCachePending.get(cacheKey);
        if (pending) {
            try {
                await pending;
                // Response.clone() 대신 캐시된 body로 새 Response 생성
                // (원본 Response body가 이미 소비되어 clone() 실패하는 버그 방지)
                const freshCached = ssrCache.get(cacheKey);
                if (freshCached) {
                    return new Response(freshCached.body, {
                        status: 200,
                        headers: {
                            'Content-Type': 'text/html; charset=utf-8',
                            'Cache-Control': publicHtmlCacheControl,
                            'X-Content-Type-Options': 'nosniff',
                            'X-Frame-Options': 'SAMEORIGIN',
                            'Referrer-Policy': 'strict-origin-when-cross-origin',
                            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
                            ...(!dev ? { 'Content-Security-Policy': cspHeader } : {}),
                            'X-SSR-Cache': 'HIT'
                        }
                    });
                }
            } catch {
                // pending 실패 시 아래에서 직접 렌더링
            }
        }

        const renderPromise = (async () => {
            const response = await resolve(event, {
                transformPageChunk: ({ html }) => rewriteImmutableAssetUrls(html)
            });

            const contentType = response.headers.get('Content-Type') || '';
            const isHtml = contentType.includes('text/html');

            if (response.status === 200 && isHtml) {
                const body = await response.text();

                // 캐시 크기 제한: 오래된 항목 정리
                if (ssrCache.size >= MAX_SSR_CACHE_SIZE) {
                    const now = Date.now();
                    for (const [key, entry] of ssrCache) {
                        const ttl =
                            key === '/'
                                ? SSR_CACHE_TTL_HOME
                                : key.includes('/')
                                  ? SSR_CACHE_TTL_POST
                                  : SSR_CACHE_TTL_BOARD;
                        if (now - entry.timestamp > ttl) ssrCache.delete(key);
                    }
                }
                ssrCache.set(cacheKey, { body, timestamp: Date.now() });

                return new Response(body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': publicHtmlCacheControl,
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'SAMEORIGIN',
                        'Referrer-Policy': 'strict-origin-when-cross-origin',
                        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
                        ...(!dev ? { 'Content-Security-Policy': cspHeader } : {}),
                        'X-SSR-Cache': 'MISS'
                    }
                });
            }

            return response;
        })();

        ssrCachePending.set(cacheKey, renderPromise);
        try {
            const result = await renderPromise;
            return result;
        } finally {
            ssrCachePending.delete(cacheKey);
        }
    }

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
            return rewriteImmutableAssetUrls(
                html.replace('<html lang="ko">', `<html lang="ko"${cls}${sty}>`),
                assetRecoveryBust
            );
        }
    });

    // CORS 헤더 (허용된 origin만 credentials 허용)
    const origin = event.request.headers.get('origin');
    if (origin && isAllowedOrigin(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
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
    // API 핸들러가 명시적으로 public Cache-Control을 설정한 경우 유지
    const existingCacheControl = response.headers.get('Cache-Control');
    const hasExplicitPublicCache =
        existingCacheControl?.includes('public') && pathname.startsWith('/api/');

    if (hasExplicitPublicCache) {
        // API 핸들러가 설정한 Cache-Control 유지 (celebration, banners, levels, reactions, init 등)
    } else if (event.url.pathname.startsWith('/_app/immutable')) {
        // SvelteKit이 이미 설정 → 그대로 유지
    } else if (!event.locals.user && isPublicCacheablePath(pathname)) {
        // 비로그인 사용자의 공개 페이지: CDN 캐시 30초, stale 60초
        response.headers.set('Cache-Control', publicHtmlCacheControl);
    } else if (!event.locals.user && isBoardListPath(pathname, event.url.searchParams)) {
        // 비로그인 사용자의 게시판 목록: CDN 캐시 30초, stale 60초
        response.headers.set('Cache-Control', publicHtmlCacheControl);
    } else if (!event.locals.user && isPostDetailPath(pathname)) {
        // 비로그인 사용자의 글 상세: CDN 캐시 30초, stale 60초
        response.headers.set('Cache-Control', publicHtmlCacheControl);
    } else {
        response.headers.set('Cache-Control', 'private, max-age=2, must-revalidate');
        response.headers.set('Vary', 'Cookie');
    }

    // SvelteKit modulepreload Link 헤더 제거 (8KB+ → 응답 헤더 축소)
    // HTML 내 <link> 태그로 이미 preload되므로 헤더는 불필요
    response.headers.delete('Link');

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

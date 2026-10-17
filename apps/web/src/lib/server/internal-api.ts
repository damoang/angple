import { createHash, timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

function isTrustedAppOrigin(origin: string, requestOrigin: string): boolean {
    try {
        const originUrl = new URL(origin);
        const requestUrl = new URL(requestOrigin);

        if (originUrl.origin === requestUrl.origin) {
            return true;
        }

        const host = originUrl.hostname;
        return (
            host === 'damoang.net' ||
            host.endsWith('.damoang.net') ||
            host === 'localhost' ||
            host === '127.0.0.1'
        );
    } catch {
        return false;
    }
}

function sha256(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

/**
 * 헤더가 내부 공유 비밀(현재 값 INTERNAL_SECRET 또는 이전 값 INTERNAL_SECRET_PREVIOUS)과
 * 일치하는지 본다. 이전 값은 비밀을 무중단으로 바꾸는 동안만 함께 받아들이며, 비어 있으면 무시한다.
 *
 * - 헤더가 비었거나 설정된 비밀이 하나도 없으면 거부한다(fail-closed).
 * - 비교는 상수 시간이다. timingSafeEqual 은 길이가 다르면 예외를 던지므로 양쪽을
 *   sha256 으로 같은 길이로 만든 뒤 비교하고, 설정된 값마다 끝까지 비교한다.
 */
export function hasValidInternalSecret(headerSecret: string | null): boolean {
    if (!headerSecret) return false;
    const presented = sha256(headerSecret);
    let matched = false;
    for (const secret of [env.INTERNAL_SECRET || '', env.INTERNAL_SECRET_PREVIOUS || '']) {
        if (!secret) continue;
        if (timingSafeEqual(presented, sha256(secret))) matched = true;
    }
    return matched;
}

/**
 * 서버 간 내부 호출 전용 판정 — 공유 비밀 헤더만 본다.
 * /api/internal/* 처럼 로그인 없이 호출되는 서버 전용 라우트는 이것만 쓴다.
 */
export function isInternalSecretRequest(request: Request): boolean {
    return hasValidInternalSecret(request.headers.get('x-internal-secret'));
}

/**
 * 쿠키로 인증하는 쓰기 요청(POST·PUT·PATCH·DELETE)이 같은 출처에서 왔는지 본다(CSRF 방어).
 *
 * - Origin 이 있으면 앱 출처와 같거나, 그 host 가 요청의 Host 헤더와 정확히 같아야 한다. 하위 도메인·localhost 는
 *   따로 허용하지 않는다. 앱 ORIGIN 설정 대신 Host 와 비교하는 이유는 같은 앱이 여러 호스트
 *   이름으로 서비스될 수 있어서다.
 * - Origin 이 없으면 Sec-Fetch-Site 가 없거나 same-origin·none 일 때만 통과한다.
 *
 * 다른 사이트의 페이지가 브라우저에 보내게 한 요청은 Origin 을 우리 Host 와 맞출 수 없다.
 * 헤더를 마음대로 꾸미는 클라이언트는 브라우저가 아니라서 다른 회원의 쿠키를 실을 수 없다.
 * 그래서 이 검사는 로그인 확인과 함께 쓸 때만 의미가 있다.
 */
export function isSameOriginRequest(request: Request): boolean {
    const origin = request.headers.get('origin');
    if (origin !== null) {
        try {
            const originUrl = new URL(origin);
            // SvelteKit 서버 fetch 하위 요청은 Host 헤더 없이 Origin 을 앱 출처로 채운다.
            if (originUrl.origin === new URL(request.url).origin) return true;
            const host = request.headers.get('host');
            return !!host && originUrl.host === host;
        } catch {
            return false;
        }
    }
    const secFetchSite = request.headers.get('sec-fetch-site');
    return secFetchSite === null || secFetchSite === 'same-origin' || secFetchSite === 'none';
}

export function crossOriginErrorResponse(): Response {
    return json({ success: false, message: '허용되지 않은 요청입니다.' }, { status: 403 });
}

// --- 헤더 기반 판정 관측 ---
// isInternalAppRequest 가 비밀값이 아니라 Origin·Referer·Sec-Fetch-Site·User-Agent 로
// 통과시킨 요청을 경로·사유별로 센다. 판정 자체는 바꾸지 않는다(관측 전용).
// 이후 단계에서 이 판정을 세션·CSRF 검사로 바꿀 때 영향받는 호출을 먼저 보기 위함이다.
type HeaderPassReason = 'origin' | 'referer' | 'sec-fetch-site' | 'user-agent';

const SHADOW_FLUSH_MS = 10 * 60_000;
const SHADOW_MAX_KEYS = 500;
const headerPassCounts = new Map<string, number>();

// 로그에 회원 아이디 같은 식별자가 남지 않도록 경로를 모양만 남긴다.
// v1 프록시(/api/v1/*)는 뒤 구간에 식별자가 오므로 첫 구간까지만 남긴다.
function routeShape(pathname: string): string {
    const v1 = /^\/api\/v1\/([^/]+)/.exec(pathname);
    if (v1) return `/api/v1/${v1[1]}/*`;
    return pathname.replace(/\/\d+(?=\/|$)/g, '/:n');
}

function recordHeaderPass(request: Request, reason: HeaderPassReason): void {
    try {
        const path = routeShape(new URL(request.url).pathname);
        const cookie = request.headers.has('cookie') ? 'cookie' : 'no-cookie';
        const key = `${request.method} ${path} ${reason} ${cookie}`;
        if (!headerPassCounts.has(key) && headerPassCounts.size >= SHADOW_MAX_KEYS) return;
        headerPassCounts.set(key, (headerPassCounts.get(key) ?? 0) + 1);
    } catch {
        // 관측 실패가 요청 처리에 영향을 주면 안 된다.
    }
}

/** 관측 카운터를 꺼내고 비운다(주기 로그와 테스트에서 쓴다). */
export function drainHeaderPassCounts(): Record<string, number> {
    const out = Object.fromEntries(headerPassCounts);
    headerPassCounts.clear();
    return out;
}

const shadowFlushTimer = setInterval(() => {
    if (headerPassCounts.size === 0) return;
    console.log(`[internal-gate-shadow] ${JSON.stringify(drainHeaderPassCounts())}`);
}, SHADOW_FLUSH_MS);
shadowFlushTimer.unref?.();

export function isInternalAppRequest(request: Request): boolean {
    if (isInternalSecretRequest(request)) {
        return true;
    }

    const requestOrigin = new URL(request.url).origin;
    const origin = request.headers.get('origin');
    if (origin) {
        const trusted = isTrustedAppOrigin(origin, requestOrigin);
        if (trusted) recordHeaderPass(request, 'origin');
        return trusted;
    }

    const referer = request.headers.get('referer');
    if (referer) {
        const trusted = isTrustedAppOrigin(referer, requestOrigin);
        if (trusted) recordHeaderPass(request, 'referer');
        return trusted;
    }

    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
        recordHeaderPass(request, 'sec-fetch-site');
        return true;
    }

    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('undici') || userAgent.includes('node')) {
        recordHeaderPass(request, 'user-agent');
        return true;
    }

    return false;
}

export function internalOnlyErrorResponse(message = '내부 앱 전용 API입니다.'): Response {
    return json({ success: false, message }, { status: 403 });
}

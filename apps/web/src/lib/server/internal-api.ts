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

export function isInternalAppRequest(request: Request): boolean {
    if (hasValidInternalSecret(request.headers.get('x-internal-secret'))) {
        return true;
    }

    const requestOrigin = new URL(request.url).origin;
    const origin = request.headers.get('origin');
    if (origin) {
        return isTrustedAppOrigin(origin, requestOrigin);
    }

    const referer = request.headers.get('referer');
    if (referer) {
        return isTrustedAppOrigin(referer, requestOrigin);
    }

    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
        return true;
    }

    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('undici') || userAgent.includes('node')) {
        return true;
    }

    return false;
}

export function internalOnlyErrorResponse(message = '내부 앱 전용 API입니다.'): Response {
    return json({ success: false, message }, { status: 403 });
}

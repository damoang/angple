import { json } from '@sveltejs/kit';

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

export function isInternalAppRequest(request: Request): boolean {
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

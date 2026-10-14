import { redirect, type Handle } from '@sveltejs/kit';
import { readSession } from './index';

/** Dedicated site boundary: shared/community credentials and auth endpoints never run here. */
export const handleWikiang: Handle = async ({ event, resolve }) => {
    event.locals.wikiangSite = true;
    event.locals.wikiUser = null;
    event.locals.user = null;
    event.locals.accessToken = null;
    event.locals.sessionId = null;
    event.locals.csrfToken = null;
    const path = event.url.pathname;
    if (path === '/login') redirect(303, '/wiki-auth');
    if (
        /^\/(?:auth|register|password-reset|cert|admin|my|member)(?:\/|$)/.test(path) ||
        (path.startsWith('/api/') && !path.startsWith('/api/wiki/'))
    ) {
        return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    try {
        const session = await readSession(event.cookies, event.url);
        if (session) {
            event.locals.wikiUser = session.user;
            event.locals.csrfToken = session.csrf;
        }
    } catch {
        return new Response('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.', {
            status: 503,
            headers: { 'Cache-Control': 'no-store' }
        });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
        const origin = event.request.headers.get('origin');
        const token = event.request.headers.get('x-csrf-token');
        // Reject explicit foreign origins even without a session. Session writes need same-origin or CSRF.
        if (
            (origin && origin !== event.url.origin) ||
            (event.locals.wikiUser &&
                origin !== event.url.origin &&
                token !== event.locals.csrfToken)
        ) {
            return new Response('요청 출처를 확인할 수 없습니다.', {
                status: 403,
                headers: { 'Cache-Control': 'no-store' }
            });
        }
    }
    const response = await resolve(event);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Referrer-Policy', 'same-origin');
    return response;
};

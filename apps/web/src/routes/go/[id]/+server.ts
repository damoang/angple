import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { logAffiliateClick } from '$lib/server/affiliate-click-log';
import { resolveAffiliateRedirect } from '$lib/server/affiliate-redirect';

const ALLOWED_PROTOCOLS = ['https:', 'http:'];

export const GET: RequestHandler = async ({ params, locals, getClientAddress, request }) => {
    const decoded = await resolveAffiliateRedirect(params.id);
    if (!decoded?.url) {
        throw redirect(302, '/');
    }

    let parsed: URL;
    try {
        parsed = new URL(decoded.url);
    } catch {
        throw redirect(302, '/');
    }

    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw redirect(302, '/');
    }

    let clientIp = '';
    try {
        clientIp = getClientAddress();
    } catch {
        clientIp = '';
    }

    void logAffiliateClick({
        userId: locals.user?.id,
        ip: clientIp,
        userAgent: request.headers.get('user-agent') || '',
        referrer: request.headers.get('referer') || '',
        targetUrl: decoded.url,
        platform: decoded.platform || '',
        board: decoded.board || '',
        postId: decoded.postId || 0
    });

    throw redirect(302, decoded.url);
};

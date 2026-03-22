import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveAffiliateRedirect } from '$lib/server/affiliate-redirect';
import { logAffiliateClick } from '$lib/server/affiliate-click-log';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

export const GET: RequestHandler = async ({ params, locals, getClientAddress, request }) => {
    const redirectId = params.id;
    if (!redirectId) {
        throw redirect(302, '/');
    }

    const record = await resolveAffiliateRedirect(redirectId);
    if (!record?.url) {
        throw redirect(302, '/');
    }

    let parsed: URL;
    try {
        parsed = new URL(record.url);
    } catch {
        throw redirect(302, '/');
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
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
        targetUrl: record.url,
        platform: record.platform,
        board: record.board || '',
        postId: record.postId || 0
    });

    throw redirect(302, record.url);
};

/**
 * 레거시 어필리에이트 리다이렉트 엔드포인트
 * GET /go?url=<encoded_url>&p=<platform>&b=<board>&w=<wr_id>
 *
 * 신규 생성 경로는 반드시 /go/<id> 를 사용한다.
 * 이 라우트는 과거 링크 호환만 담당한다.
 */

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { logAffiliateClick } from '$lib/server/affiliate-click-log';

/** 허용된 프로토콜 (open redirect 방지) */
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

export const GET: RequestHandler = async ({ url, locals, getClientAddress, request }) => {
    const targetUrl = url.searchParams.get('url') || '';
    const platform = url.searchParams.get('p') || '';
    const board = url.searchParams.get('b') || '';
    const postId = parseInt(url.searchParams.get('w') || '0', 10);

    console.warn('[AffiliateRedirect] legacy /go?url fallback used', {
        platform,
        board,
        postId: isNaN(postId) ? 0 : postId,
        hasTargetUrl: Boolean(targetUrl)
    });

    // URL 검증
    if (!targetUrl) {
        throw redirect(302, '/');
    }

    let parsed: URL;
    try {
        parsed = new URL(targetUrl);
    } catch {
        throw redirect(302, '/');
    }

    // open redirect 방지: https/http만 허용
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw redirect(302, '/');
    }

    // 클릭 로깅 (fire-and-forget — 리다이렉트를 블로킹하지 않음)
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
        targetUrl,
        platform,
        board,
        postId: isNaN(postId) ? 0 : postId
    });

    throw redirect(302, targetUrl);
};

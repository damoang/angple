import { readWikiInput, wikiWriteError } from '$lib/server/wiki-input';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWikiPage, isIpBlocked, makeWikiAuthor } from '$lib/server/wiki';
import { checkWikiEditRateLimit, rateLimitedResponse } from '$lib/server/wiki-rate-limit';

/** 클라이언트 IP 안전 조회 (SSR 내부 fetch에서는 헤더 부재로 throw할 수 있음) */
function safeClientIp(getClientAddress: () => string): string | null {
    try {
        return getClientAddress();
    } catch {
        return null;
    }
}

/**
 * POST /api/wiki/pages - 신규 위키 페이지 생성 (익명 편집 허용)
 */
export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
    // 로그인 회원이면 author_id로 귀속, 익명이면 null (IP로만 귀속)
    const rawUserId = locals.user?.id ? parseInt(locals.user.id, 10) : NaN;
    const userId = Number.isNaN(rawUserId) ? null : rawUserId;

    // 작성 IP 취득 및 차단 조회
    const ip = safeClientIp(getClientAddress);
    if (await isIpBlocked(ip)) {
        error(403, { message: '차단된 IP에서는 편집할 수 없습니다.' });
    }

    // 레이트리밋 (초과 = 429)
    const rl = await checkWikiEditRateLimit(ip, userId);
    if (!rl.allowed) {
        return rateLimitedResponse(rl.retryAfter);
    }

    try {
        const { path, input } = await readWikiInput(request, true);
        const result = await createWikiPage(path, input, makeWikiAuthor(userId, ip));

        return json({
            success: true,
            pageId: result.pageId,
            revisionId: result.revisionId,
            path: path.startsWith('/') ? path : `/${path}`
        });
    } catch (err) {
        wikiWriteError(err);
    }
};

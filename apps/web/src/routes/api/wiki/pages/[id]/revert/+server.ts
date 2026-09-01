import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { revertWikiPage, getWikiPageById, isIpBlocked, makeWikiAuthor } from '$lib/server/wiki';
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
 * POST /api/wiki/pages/[id]/revert - 과거 리비전 내용으로 되돌리기 (익명 편집 허용)
 *
 * body: { revisionId?: number } 또는 { versionNumber?: number }
 * - 대상 리비전 내용으로 새 리비전을 생성한다(히스토리 보존).
 * - 작성자 귀속은 요청자 IP/회원. 원본 IP는 author_ip(VARBINARY)에만 저장되고
 *   응답으로는 새지 않는다(해시만 노출).
 */
export const POST: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
    // 로그인 회원이면 author_id로 귀속, 익명이면 null (IP로만 귀속)
    const rawUserId = locals.user?.id ? parseInt(locals.user.id, 10) : NaN;
    const userId = Number.isNaN(rawUserId) ? null : rawUserId;

    const pageId = parseInt(params.id, 10);
    if (isNaN(pageId)) {
        error(400, { message: '유효하지 않은 페이지 ID입니다.' });
    }

    // 작성 IP 취득 및 차단 조회 (차단 = 403)
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
        // 페이지 존재 확인
        const existingPage = await getWikiPageById(pageId);
        if (!existingPage) {
            error(404, { message: '문서를 찾을 수 없습니다.' });
        }

        const body = await request.json();
        const revisionId =
            body.revisionId != null ? parseInt(String(body.revisionId), 10) : undefined;
        const versionNumber =
            body.versionNumber != null ? parseInt(String(body.versionNumber), 10) : undefined;

        if (
            (revisionId == null || Number.isNaN(revisionId)) &&
            (versionNumber == null || Number.isNaN(versionNumber))
        ) {
            error(400, { message: 'revisionId 또는 versionNumber가 필요합니다.' });
        }

        const result = await revertWikiPage(
            pageId,
            {
                revisionId: Number.isNaN(revisionId as number) ? undefined : revisionId,
                versionNumber: Number.isNaN(versionNumber as number) ? undefined : versionNumber
            },
            makeWikiAuthor(userId, ip)
        );

        return json({
            success: true,
            pageId,
            revisionId: result.revisionId,
            versionNumber: result.versionNumber,
            sourceVersion: result.sourceVersion,
            path: result.path
        });
    } catch (err) {
        // SvelteKit error() 는 다시 throw 되도록 통과
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        console.error('Wiki page revert error:', err);
        const message = err instanceof Error ? err.message : '되돌리기에 실패했습니다.';
        error(500, { message });
    }
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateWikiPage, getWikiPageById, isIpBlocked, makeWikiAuthor } from '$lib/server/wiki';

/** 클라이언트 IP 안전 조회 (SSR 내부 fetch에서는 헤더 부재로 throw할 수 있음) */
function safeClientIp(getClientAddress: () => string): string | null {
    try {
        return getClientAddress();
    } catch {
        return null;
    }
}

/**
 * PUT /api/wiki/pages/[id] - 위키 페이지 수정 (익명 편집 허용)
 */
export const PUT: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
    // 로그인 회원이면 author_id로 귀속, 익명이면 null (IP로만 귀속)
    const rawUserId = locals.user?.id ? parseInt(locals.user.id, 10) : NaN;
    const userId = Number.isNaN(rawUserId) ? null : rawUserId;

    const pageId = parseInt(params.id, 10);
    if (isNaN(pageId)) {
        error(400, { message: '유효하지 않은 페이지 ID입니다.' });
    }

    // 작성 IP 취득 및 차단 조회
    const ip = safeClientIp(getClientAddress);
    if (await isIpBlocked(ip)) {
        error(403, { message: '차단된 IP에서는 편집할 수 없습니다.' });
    }

    try {
        // 페이지 존재 확인
        const existingPage = await getWikiPageById(pageId);
        if (!existingPage) {
            error(404, { message: '문서를 찾을 수 없습니다.' });
        }

        const body = await request.json();
        const { title, content, content_raw, content_type, description, comment, is_minor } = body;

        // 필수 필드 검증
        if (!title) {
            error(400, { message: '제목은 필수입니다.' });
        }

        const result = await updateWikiPage(
            pageId,
            {
                title,
                content: content || '',
                content_raw: content_raw || content || '',
                content_type: content_type || 'html',
                description,
                comment: comment || '',
                is_minor: is_minor || false
            },
            makeWikiAuthor(userId, ip)
        );

        return json({
            success: true,
            pageId,
            revisionId: result.revisionId,
            versionNumber: result.versionNumber,
            path: existingPage.path
        });
    } catch (err) {
        console.error('Wiki page update error:', err);
        const message = err instanceof Error ? err.message : '문서 수정에 실패했습니다.';
        error(500, { message });
    }
};

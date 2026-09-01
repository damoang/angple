import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWikiPage, isIpBlocked, makeWikiAuthor } from '$lib/server/wiki';

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

    try {
        const body = await request.json();
        const { path, title, content, content_raw, content_type, description, comment } = body;

        // 필수 필드 검증
        if (!path || !title) {
            error(400, { message: '경로와 제목은 필수입니다.' });
        }

        const result = await createWikiPage(
            path,
            {
                title,
                content: content || '',
                content_raw: content_raw || content || '',
                content_type: content_type || 'html',
                description,
                comment: comment || '문서 생성'
            },
            makeWikiAuthor(userId, ip)
        );

        return json({
            success: true,
            pageId: result.pageId,
            revisionId: result.revisionId,
            path: path.startsWith('/') ? path : `/${path}`
        });
    } catch (err) {
        console.error('Wiki page creation error:', err);
        const message = err instanceof Error ? err.message : '문서 생성에 실패했습니다.';
        error(500, { message });
    }
};

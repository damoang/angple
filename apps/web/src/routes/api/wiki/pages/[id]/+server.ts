import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateWikiPage, getWikiPageById } from '$lib/server/wiki';

/**
 * PUT /api/wiki/pages/[id] - 위키 페이지 수정
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
    // 인증 확인
    const user = locals.user;
    if (!user || !user.id) {
        error(401, { message: '로그인이 필요합니다.' });
    }

    const authorId = parseInt(user.id, 10);
    if (isNaN(authorId)) {
        error(401, { message: '유효하지 않은 사용자입니다.' });
    }

    const pageId = parseInt(params.id, 10);
    if (isNaN(pageId)) {
        error(400, { message: '유효하지 않은 페이지 ID입니다.' });
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
            authorId
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

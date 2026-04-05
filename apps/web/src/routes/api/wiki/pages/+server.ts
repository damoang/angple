import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWikiPage } from '$lib/server/wiki';

/**
 * POST /api/wiki/pages - 신규 위키 페이지 생성
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    // 인증 확인
    const user = locals.user;
    if (!user) {
        error(401, { message: '로그인이 필요합니다.' });
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
            user.id
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

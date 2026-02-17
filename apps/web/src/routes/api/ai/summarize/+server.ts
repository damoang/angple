import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { summarizeContent } from '$lib/server/ai-content.js';

/**
 * AI 게시글 요약 API
 *
 * POST /api/ai/summarize
 * Body: { title, content }
 * Response: { summary, keywords, category } | { error }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
        const { title, content } = await request.json();

        if (!title || !content) {
            return json({ error: 'title과 content가 필요합니다.' }, { status: 400 });
        }

        const result = await summarizeContent(title, content);
        if (!result) {
            return json({ error: 'AI 서비스를 사용할 수 없습니다.' }, { status: 503 });
        }

        return json(result);
    } catch (err) {
        console.error('[AI summarize] 오류:', err);
        return json({ error: '요약 생성 실패' }, { status: 500 });
    }
};

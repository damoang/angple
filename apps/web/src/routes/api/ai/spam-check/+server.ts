import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { checkSpam } from '$lib/server/spam-filter.js';
import { analyzeSpamWithAI } from '$lib/server/ai-content.js';

/**
 * 콘텐츠 스팸 검사 API (규칙 기반 + AI 보조)
 *
 * POST /api/ai/spam-check
 * Body: { title, content }
 * Response: { isSpam, reason, aiScore? }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
        const { title, content } = await request.json();

        if (!title && !content) {
            return json({ error: 'title 또는 content가 필요합니다.' }, { status: 400 });
        }

        // 1단계: 규칙 기반 스팸 체크 (빠르고 비용 없음)
        const ruleResult = await checkSpam(title || '', content || '');
        if (ruleResult.isSpam) {
            return json({
                isSpam: true,
                reason: ruleResult.reason,
                method: 'rule'
            });
        }

        // 2단계: AI 보조 스팸 분석 (선택적, API 키가 있을 때만)
        const aiResult = await analyzeSpamWithAI(title || '', content || '');
        if (aiResult?.isSpam) {
            return json({
                isSpam: true,
                reason: aiResult.reason,
                aiScore: aiResult.score,
                method: 'ai'
            });
        }

        return json({
            isSpam: false,
            aiScore: aiResult?.score ?? null,
            method: aiResult ? 'ai' : 'rule'
        });
    } catch (err) {
        console.error('[spam-check] 오류:', err);
        return json({ isSpam: false, error: '스팸 검사 실패' }, { status: 500 });
    }
};

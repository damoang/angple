/**
 * 승급 대상 회원 목록 API
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getPromotionCandidates } from '$lib/server/auth/auto-promotion.js';

export const GET: RequestHandler = async ({ locals }) => {
    // 관리자 권한 확인
    if (!locals.user || (locals.user.level ?? 0) < 8) {
        return json(
            { error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' } },
            { status: 403 }
        );
    }

    try {
        const candidates = await getPromotionCandidates();
        return json({ data: { candidates } });
    } catch (err) {
        console.error('[Admin Levels] Failed to get candidates:', err);
        return json({ error: { code: 'INTERNAL', message: '대상 조회 실패' } }, { status: 500 });
    }
};

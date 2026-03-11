/**
 * 모든 대상 일괄 승급 API
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { promoteAllEligible } from '$lib/server/auth/auto-promotion.js';

export const POST: RequestHandler = async ({ locals }) => {
    // 관리자 권한 확인
    if (!locals.user || (locals.user.level ?? 0) < 8) {
        return json(
            { error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' } },
            { status: 403 }
        );
    }

    try {
        const result = await promoteAllEligible();
        console.log(`[Admin Levels] Promoted ${result.promoted} members (${result.failed} failed)`);
        return json({ data: result });
    } catch (err) {
        console.error('[Admin Levels] Failed to promote all:', err);
        return json({ error: { code: 'INTERNAL', message: '일괄 승급 실패' } }, { status: 500 });
    }
};

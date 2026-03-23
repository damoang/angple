import { json, type RequestHandler } from '@sveltejs/kit';
import { getRecentPromotionHistory } from '$lib/server/auth/auto-promotion.js';
import { isMissingLevelHistoryTableError } from '$lib/server/auth/member-level-history.js';

export const GET: RequestHandler = async ({ locals, url }) => {
    if (!locals.user || (locals.user.level ?? 0) < 8) {
        return json(
            { error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' } },
            { status: 403 }
        );
    }

    const days = Number(url.searchParams.get('days') ?? '4');
    const limit = Number(url.searchParams.get('limit') ?? '100');

    try {
        const history = await getRecentPromotionHistory(days, limit);
        return json({ data: { history } });
    } catch (err) {
        if (isMissingLevelHistoryTableError(err)) {
            return json({ data: { history: [] } });
        }
        console.error('[Admin Levels] Failed to get history:', err);
        return json(
            { error: { code: 'INTERNAL', message: '승급 이력 조회 실패' } },
            { status: 500 }
        );
    }
};

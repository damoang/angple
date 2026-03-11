/**
 * 특정 회원 승급 API
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { checkAndPromoteMember } from '$lib/server/auth/auto-promotion.js';

export const POST: RequestHandler = async ({ locals, request }) => {
    // 관리자 권한 확인
    if (!locals.user || (locals.user.level ?? 0) < 8) {
        return json(
            { error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' } },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const mbId = body.mb_id;

        if (!mbId || typeof mbId !== 'string') {
            return json(
                { error: { code: 'INVALID', message: 'mb_id가 필요합니다.' } },
                { status: 400 }
            );
        }

        const result = await checkAndPromoteMember(mbId);

        if (!result) {
            return json({ data: { promoted: false, message: '승급 조건을 충족하지 않습니다.' } });
        }

        return json({ data: { promoted: result.promoted, newLevel: result.newLevel } });
    } catch (err) {
        console.error('[Admin Levels] Failed to promote member:', err);
        return json({ error: { code: 'INTERNAL', message: '승급 실패' } }, { status: 500 });
    }
};

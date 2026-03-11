/**
 * 등급 승급 규칙 API
 * GET: 규칙 조회
 * PUT: 규칙 저장
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getPromotionRules, savePromotionRules, type PromotionRule } from '$lib/server/auth/auto-promotion.js';

export const GET: RequestHandler = async ({ locals }) => {
    // 관리자 권한 확인
    if (!locals.user || (locals.user.level ?? 0) < 8) {
        return json({ error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' } }, { status: 403 });
    }

    try {
        const rules = await getPromotionRules();
        return json({ data: { rules } });
    } catch (err) {
        console.error('[Admin Levels] Failed to get rules:', err);
        return json({ error: { code: 'INTERNAL', message: '규칙 조회 실패' } }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ locals, request }) => {
    // 관리자 권한 확인
    if (!locals.user || (locals.user.level ?? 0) < 8) {
        return json({ error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' } }, { status: 403 });
    }

    try {
        const body = await request.json();
        const rules: PromotionRule[] = body.rules;

        // 유효성 검사
        if (!Array.isArray(rules)) {
            return json({ error: { code: 'INVALID', message: 'rules는 배열이어야 합니다.' } }, { status: 400 });
        }

        for (const rule of rules) {
            if (typeof rule.fromLevel !== 'number' || typeof rule.toLevel !== 'number' ||
                typeof rule.minLoginDays !== 'number' || typeof rule.minXP !== 'number') {
                return json({ error: { code: 'INVALID', message: '잘못된 규칙 형식입니다.' } }, { status: 400 });
            }
            if (rule.fromLevel >= rule.toLevel) {
                return json({ error: { code: 'INVALID', message: 'toLevel은 fromLevel보다 커야 합니다.' } }, { status: 400 });
            }
            if (rule.minLoginDays < 0 || rule.minXP < 0) {
                return json({ error: { code: 'INVALID', message: '조건 값은 0 이상이어야 합니다.' } }, { status: 400 });
            }
        }

        await savePromotionRules(rules);
        return json({ data: { success: true } });
    } catch (err) {
        console.error('[Admin Levels] Failed to save rules:', err);
        return json({ error: { code: 'INTERNAL', message: '규칙 저장 실패' } }, { status: 500 });
    }
};

/**
 * 등급 및 자동 승급 설정 페이지 서버 로드
 */
import type { PageServerLoad } from './$types';
import { getPromotionRules } from '$lib/server/auth/auto-promotion.js';

export const load: PageServerLoad = async () => {
    const rules = await getPromotionRules();
    return { rules };
};

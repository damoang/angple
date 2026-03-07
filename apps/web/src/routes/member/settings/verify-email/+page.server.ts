/**
 * 이메일 변경 인증 확인 페이지
 * URL: /member/settings/verify-email?token=xxx&mb_id=xxx
 */
import type { PageServerLoad } from './$types';
import { confirmEmailChange } from '$lib/server/auth/member-update.js';

export const load: PageServerLoad = async ({ url }) => {
    const token = url.searchParams.get('token');
    const mbId = url.searchParams.get('mb_id');

    if (!token || !mbId) {
        return { success: false, error: '유효하지 않은 인증 링크입니다.' };
    }

    const result = await confirmEmailChange(mbId, token);

    return {
        success: result.success,
        error: result.error || null,
        newEmail: result.newEmail || null
    };
};

/**
 * /my/reports — 내가 신고한 목록.
 *
 * 인증 게이트는 /my/+layout.server.ts 가 이미 처리한다(비로그인 → /login redirect).
 * 데이터는 SvelteKit 서버 직접 쿼리 — Go 백엔드에 na_singo 핸들러가 없고,
 * /my 목록 계열(scraps·following)의 기존 방식과 같다.
 */
import type { PageServerLoad } from './$types';
import { getMyReports } from '$lib/server/my-reports.js';

export const load: PageServerLoad = async ({ url, locals, depends }) => {
    depends('app:my-reports');

    const mbId = locals.user?.id;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);

    if (!mbId) {
        return { reports: { items: [], total: 0, page: 1, totalPages: 1, error: false } };
    }

    return { reports: await getMyReports(mbId, page) };
};

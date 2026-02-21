import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

/**
 * 글쓰기 페이지 서버 로드
 * 인증 체크 (로그인 필수) + 레벨 체크
 */
export const load: PageServerLoad = async ({ locals, params }) => {
    const { boardId } = params;

    // 서버 사이드 인증 검증 — 미인증 사용자는 로그인 페이지로 리다이렉트
    if (!locals.user) {
        redirect(302, `/login?redirect=/${boardId}/write`);
    }

    return {};
};

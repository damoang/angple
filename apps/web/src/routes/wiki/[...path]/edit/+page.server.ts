import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getWikiPageForEdit } from '$lib/server/wiki';

export const load: PageServerLoad = async ({ params, locals }) => {
    const path = params.path || '';

    // Special 페이지는 편집 불가
    if (path.startsWith('Special:')) {
        error(403, { message: '특수 페이지는 편집할 수 없습니다.' });
    }

    // 익명 편집 허용: 로그인 게이트 제거 (비로그인도 편집 가능, 귀속은 IP로)

    // 기존 페이지 조회 (없으면 신규 문서)
    const wikiPage = await getWikiPageForEdit(`/${path}`);

    // 경로에서 제목 추출 (신규 문서용)
    const titleFromPath = decodeURIComponent(path.split('/').pop() || path);

    // 로그인 회원이면 회원 정보, 익명이면 null
    const userId = locals.user?.id ? parseInt(locals.user.id, 10) : null;

    return {
        wikiPage,
        isNew: !wikiPage,
        path: `/${path}`,
        suggestedTitle: wikiPage?.title || titleFromPath,
        user: locals.user
            ? {
                  id: Number.isNaN(userId) ? null : userId,
                  nickname: locals.user.nickname || '익명'
              }
            : null
    };
};

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getWikiPageForEdit, getWikiPage } from '$lib/server/wiki';

export const load: PageServerLoad = async ({ params, locals }) => {
    const path = params.path || '';

    // Special 페이지는 편집 불가
    if (path.startsWith('Special:')) {
        error(403, { message: '특수 페이지는 편집할 수 없습니다.' });
    }

    // 익명 편집 허용: 로그인 게이트 제거 (비로그인도 편집 가능, 귀속은 IP로)

    // 기존 페이지 조회 (없으면 신규 문서)
    const wikiPage = await getWikiPageForEdit(`/${path}`);
    if (!wikiPage && (await getWikiPage(`/${path}`)))
        error(403, '시스템 문서는 편집할 수 없습니다.');

    // 경로에서 제목 추출 (신규 문서용)
    const titleFromPath = path.split('/').pop() || path;

    return {
        wikiPage,
        baseRevision: wikiPage?.base_revision ?? 0,
        isNew: !wikiPage,
        path: `/${path}`,
        suggestedTitle: wikiPage?.title || titleFromPath,
        user: locals.wikiUser ?? null
    };
};

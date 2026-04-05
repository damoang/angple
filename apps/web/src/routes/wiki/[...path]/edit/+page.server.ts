import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { getWikiPageForEdit } from '$lib/server/wiki';

export const load: PageServerLoad = async ({ params, locals }) => {
    const path = params.path || '';

    // Special 페이지는 편집 불가
    if (path.startsWith('Special:')) {
        error(403, { message: '특수 페이지는 편집할 수 없습니다.' });
    }

    // 인증 확인
    if (!locals.user) {
        // 로그인 페이지로 리다이렉트 (원래 URL 보존)
        const returnUrl = encodeURIComponent(`/wiki/${path}/edit`);
        redirect(302, `/login?redirect=${returnUrl}`);
    }

    // 기존 페이지 조회 (없으면 신규 문서)
    const wikiPage = await getWikiPageForEdit(`/${path}`);

    // 경로에서 제목 추출 (신규 문서용)
    const titleFromPath = decodeURIComponent(path.split('/').pop() || path);

    // user.id는 string이므로 number로 변환 (위키 API에서 필요)
    const userId = locals.user.id ? parseInt(locals.user.id, 10) : 0;

    return {
        wikiPage,
        isNew: !wikiPage,
        path: `/${path}`,
        suggestedTitle: wikiPage?.title || titleFromPath,
        user: {
            id: userId,
            nickname: locals.user.nickname || '익명'
        }
    };
};

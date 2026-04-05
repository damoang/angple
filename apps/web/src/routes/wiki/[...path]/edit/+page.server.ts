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

    return {
        wikiPage,
        isNew: !wikiPage,
        path: `/${path}`,
        suggestedTitle: wikiPage?.title || titleFromPath,
        user: {
            id: locals.user.id,
            username: locals.user.username,
            nickname: locals.user.nickname
        }
    };
};

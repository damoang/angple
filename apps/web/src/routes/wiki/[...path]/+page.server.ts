import type { PageServerLoad } from './$types';
import { getWikiPage } from '$lib/server/wiki';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
    const path = params.path || '';

    // Special 페이지 처리
    if (path.startsWith('Special:')) {
        const specialPage = path.replace('Special:', '');
        return {
            isSpecialPage: true,
            specialType: specialPage,
            wikiPage: null
        };
    }

    // 일반 위키 페이지 조회
    const wikiPage = await getWikiPage(`/${path}`);

    if (!wikiPage) {
        error(404, {
            message: `문서 "${decodeURIComponent(path)}"을(를) 찾을 수 없습니다.`
        });
    }

    return {
        isSpecialPage: false,
        specialType: null,
        wikiPage
    };
};

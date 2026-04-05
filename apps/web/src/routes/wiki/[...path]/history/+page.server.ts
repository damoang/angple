import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
    getWikiPage,
    getPageIdByPath,
    getPageRevisions,
    getRevisionPair,
    type WikiPage,
    type WikiRevision
} from '$lib/server/wiki';

export const load: PageServerLoad = async ({ params, url }) => {
    const path = params.path || '';

    // Special 페이지는 이력이 없음
    if (path.startsWith('Special:')) {
        error(404, { message: '특수 페이지는 이력이 없습니다.' });
    }

    // 페이지 정보 조회
    const wikiPage = await getWikiPage(`/${path}`);

    if (!wikiPage) {
        error(404, {
            message: `문서 "${decodeURIComponent(path)}"을(를) 찾을 수 없습니다.`
        });
    }

    // 리비전 목록 조회
    const revisions = await getPageRevisions(wikiPage.id, 100);

    // diff 모드 체크 (두 리비전 비교)
    const oldId = url.searchParams.get('oldid');
    const newId = url.searchParams.get('diff');
    let diffData: { old: WikiRevision | null; new: WikiRevision | null } | null = null;

    if (oldId && newId) {
        const oldIdNum = parseInt(oldId, 10);
        const newIdNum = parseInt(newId, 10);
        if (!isNaN(oldIdNum) && !isNaN(newIdNum)) {
            diffData = await getRevisionPair(oldIdNum, newIdNum);
        }
    }

    return {
        wikiPage,
        revisions,
        diffMode: !!diffData,
        diffData
    };
};

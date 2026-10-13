import type { LayoutServerLoad } from './$types';
import { getPageTree } from '$lib/server/wiki';
import {
    parseWikiSkin,
    WIKI_SKIN_COOKIE,
    parseWikiTextSize,
    WIKI_TEXT_COOKIE
} from '$lib/wiki/skins';

// 위키 좌측 페이지 트리 (모든 위키 페이지 공통). 실패해도 빈 트리로 graceful.
export const load: LayoutServerLoad = async ({ cookies }) => {
    const pageTree = await getPageTree().catch(() => []);
    return {
        pageTree,
        wikiSkin: parseWikiSkin(cookies.get(WIKI_SKIN_COOKIE)),
        wikiTextSize: parseWikiTextSize(cookies.get(WIKI_TEXT_COOKIE))
    };
};

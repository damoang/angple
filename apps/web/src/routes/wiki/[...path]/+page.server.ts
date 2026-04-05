import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import {
    getWikiPage,
    getRecentPages,
    getRandomPage,
    getAllPages,
    getCategories,
    getPagesByCategory,
    getTags,
    getPagesByTag,
    searchPages,
    type WikiPage,
    type WikiPageSummary,
    type WikiCategory,
    type WikiTag,
    type WikiSearchResult,
    type PaginatedResult
} from '$lib/server/wiki';

// Special 페이지 타입 정의
type SpecialPageData =
    | { type: 'RecentChanges'; pages: WikiPageSummary[] }
    | { type: 'AllPages'; result: PaginatedResult<WikiPageSummary>; sort: string }
    | { type: 'Categories'; categories: WikiCategory[] }
    | {
          type: 'Category';
          category: WikiCategory | null;
          categoryId: number;
          result: PaginatedResult<WikiPageSummary>;
      }
    | { type: 'Tags'; tags: WikiTag[] }
    | { type: 'Tag'; tag: WikiTag | null; tagId: number; result: PaginatedResult<WikiPageSummary> }
    | { type: 'Search'; query: string; result: PaginatedResult<WikiSearchResult> }
    | { type: 'Unknown'; name: string };

export const load: PageServerLoad = async ({ params, url }) => {
    const path = params.path || '';

    // Special 페이지 처리
    if (path.startsWith('Special:')) {
        const specialPage = path.replace('Special:', '');
        const specialData = await handleSpecialPage(specialPage, url);

        return {
            isSpecialPage: true,
            specialType: specialData.type,
            specialData,
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
        specialData: null,
        wikiPage
    };
};

/**
 * Special 페이지 처리
 */
async function handleSpecialPage(pageName: string, url: URL): Promise<SpecialPageData> {
    // URL 파라미터 파싱
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    switch (pageName) {
        case 'RecentChanges': {
            const pages = await getRecentPages(50);
            return { type: 'RecentChanges', pages };
        }

        case 'Random': {
            const page = await getRandomPage();
            if (page) {
                // 한글 경로를 URL 인코딩
                const encodedPath = page.path.split('/').map(encodeURIComponent).join('/');
                redirect(302, `/wiki${encodedPath}`);
            }
            // 페이지가 없으면 메인으로
            redirect(302, '/wiki');
        }

        case 'AllPages': {
            const sort = (url.searchParams.get('sort') || 'title') as 'title' | 'updated';
            const result = await getAllPages(offset, limit, sort);
            return { type: 'AllPages', result, sort };
        }

        case 'Categories': {
            const categories = await getCategories();
            return { type: 'Categories', categories };
        }

        case 'Tags': {
            const tags = await getTags();
            return { type: 'Tags', tags };
        }

        case 'Search': {
            const query = url.searchParams.get('q') || '';
            const result = await searchPages(query, offset, limit);
            return { type: 'Search', query, result };
        }

        default: {
            // Special:Category/xxx 또는 Special:Tag/xxx 처리
            if (pageName.startsWith('Category/')) {
                const categoryIdStr = pageName.replace('Category/', '');
                const categoryId = parseInt(categoryIdStr, 10);
                if (!isNaN(categoryId)) {
                    const [categories, result] = await Promise.all([
                        getCategories(),
                        getPagesByCategory(categoryId, offset, limit)
                    ]);
                    const category = categories.find((c) => c.id === categoryId) || null;
                    return { type: 'Category', category, categoryId, result };
                }
            }

            if (pageName.startsWith('Tag/')) {
                const tagIdStr = pageName.replace('Tag/', '');
                const tagId = parseInt(tagIdStr, 10);
                if (!isNaN(tagId)) {
                    const [tags, result] = await Promise.all([
                        getTags(),
                        getPagesByTag(tagId, offset, limit)
                    ]);
                    const tag = tags.find((t) => t.id === tagId) || null;
                    return { type: 'Tag', tag, tagId, result };
                }
            }

            return { type: 'Unknown', name: pageName };
        }
    }
}

import type { PageLoad } from './$types.js';
import { apiClient } from '$lib/api/client.js';
import { maskTitleFields } from '$lib/utils/email-reveal.js';

export const load: PageLoad = async ({ params, url }) => {
    const tag = decodeURIComponent(params.tag);
    const page = Number(url.searchParams.get('page')) || 1;

    try {
        // 전체 게시판에서 태그로 검색
        const results = await apiClient.searchPosts('all', {
            query: '',
            field: 'title_content',
            tag,
            page,
            limit: 20
        });

        return {
            tag,
            // 이메일 주소 수집 방지 — SSR HTML·페이지 데이터에 제목 원문 주소를 남기지 않는다.
            posts: maskTitleFields(results),
            page
        };
    } catch {
        return {
            tag,
            posts: { items: [], total: 0, page: 1, limit: 20, total_pages: 0 },
            page
        };
    }
};

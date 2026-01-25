import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';
import type { SearchField, GlobalSearchResponse } from '$lib/api/types.js';

export const load: PageLoad = async ({ url }) => {
    const query = url.searchParams.get('q') || '';
    const field = (url.searchParams.get('sfl') as SearchField) || 'title_content';

    // 검색어가 없으면 빈 결과 반환
    if (!query.trim()) {
        return {
            searchResults: null,
            query: '',
            field
        };
    }

    try {
        const searchResults = await apiClient.searchGlobal(query, field, 5);

        return {
            searchResults,
            query,
            field
        };
    } catch (error) {
        console.error('전체 검색 에러:', error);
        return {
            searchResults: null,
            query,
            field,
            error: '검색 중 오류가 발생했습니다.'
        };
    }
};

import type { PageLoad } from './$types.js';
import type { SearchField } from '$lib/api/types.js';
import { safeJson } from '$lib/api/safe-json.js';

export const load: PageLoad = async ({ url, fetch }) => {
    const query = url.searchParams.get('q') || '';
    const field = (url.searchParams.get('sfl') as SearchField) || 'title_content';

    if (!query.trim()) {
        return {
            searchResults: null,
            query: '',
            field
        };
    }

    try {
        const params = new URLSearchParams({ q: query, sfl: field, limit: '5' });
        const res = await fetch(`/api/search?${params.toString()}`);
        const json = await safeJson(res);

        return {
            searchResults: json.success ? json.data : null,
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

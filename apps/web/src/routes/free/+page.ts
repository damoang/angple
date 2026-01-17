import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ url }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;

    try {
        // 게시판 정보와 게시글 목록을 병렬로 가져오기
        const [data, board] = await Promise.all([
            apiClient.getFreePosts(page, limit),
            apiClient.getBoard('free')
        ]);

        return {
            posts: data.items,
            pagination: {
                total: data.total,
                page: data.page,
                limit: data.limit,
                totalPages: data.total_pages
            },
            board // 게시판 설정 정보 추가
        };
    } catch (error) {
        console.error('게시글 로딩 에러:', error);
        return {
            posts: [],
            pagination: {
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 0
            },
            board: null, // 에러 시 null
            error: '게시글을 불러오는데 실패했습니다.'
        };
    }
};

import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';
import type { SearchField } from '$lib/api/types.js';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

export const load: PageLoad = async ({ url, params }) => {
    const boardId = params.boardId;
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;

    // 검색 파라미터
    const searchField = (url.searchParams.get('sfl') as SearchField) || null;
    const searchQuery = url.searchParams.get('stx') || null;
    const isSearching = Boolean(searchField && searchQuery);

    try {
        // 게시판 정보, 공지사항, 게시글 목록을 병렬로 가져오기
        const [data, board, notices] = await Promise.all([
            isSearching
                ? apiClient.searchPosts(boardId, {
                      field: searchField!,
                      query: searchQuery!,
                      page,
                      limit
                  })
                : apiClient.getBoardPosts(boardId, page, limit),
            apiClient.getBoard(boardId),
            // 검색 중이 아닐 때만 공지사항 로드
            isSearching ? Promise.resolve([]) : apiClient.getBoardNotices(boardId)
        ]);

        return {
            boardId,
            posts: data.items,
            notices,
            pagination: {
                total: data.total,
                page: data.page,
                limit: data.limit,
                totalPages: data.total_pages
            },
            board,
            searchParams: isSearching
                ? { field: searchField!, query: searchQuery! }
                : null
        };
    } catch (error) {
        console.error(`게시판 ${boardId} 로딩 에러:`, error);
        return {
            boardId,
            posts: [],
            notices: [],
            pagination: {
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 0
            },
            board: null,
            searchParams: null,
            error: '게시글을 불러오는데 실패했습니다.'
        };
    }
};

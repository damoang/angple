import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';
import type { SearchField } from '$lib/api/types.js';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

export const load: PageLoad = async ({ url, params, fetch }) => {
    const boardId = params.boardId;
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;

    // 검색 파라미터
    const searchField = (url.searchParams.get('sfl') as SearchField) || null;
    const searchQuery = url.searchParams.get('stx') || null;
    const tag = url.searchParams.get('tag') || null;
    const isSearching = Boolean(searchField && searchQuery);
    const isTagFiltering = Boolean(tag);

    try {
        // 게시판 정보, 공지사항, 게시글 목록을 병렬로 가져오기
        const [data, board, notices] = await Promise.all([
            isSearching
                ? apiClient.withFetch(fetch).searchPosts(boardId, {
                      field: searchField!,
                      query: searchQuery!,
                      page,
                      limit,
                      tag: tag || undefined
                  })
                : isTagFiltering
                  ? apiClient.withFetch(fetch).searchPosts(boardId, {
                        field: 'title_content',
                        query: '',
                        page,
                        limit,
                        tag: tag!
                    })
                  : apiClient.withFetch(fetch).getBoardPosts(boardId, page, limit),
            apiClient.withFetch(fetch).getBoard(boardId),
            // 검색 중이 아닐 때만 공지사항 로드
            isSearching ? Promise.resolve([]) : apiClient.withFetch(fetch).getBoardNotices(boardId)
        ]);

        // 직접홍보 사잇광고 (비블로킹 — 실패해도 빈 배열)
        const promotionPostsResult = await fetch('/api/ads/promotion-posts')
            .then((r) => r.json())
            .catch(() => ({ success: false, data: { posts: [] } }));

        return {
            boardId,
            posts: data.items,
            notices,
            promotionPosts: promotionPostsResult?.data?.posts || [],
            pagination: {
                total: data.total,
                page: data.page,
                limit: data.limit,
                totalPages: data.total_pages
            },
            board,
            searchParams: isSearching ? { field: searchField!, query: searchQuery! } : null,
            activeTag: tag
        };
    } catch (error) {
        console.error('게시판 로딩 에러:', boardId, error);
        return {
            boardId,
            posts: [],
            notices: [],
            promotionPosts: [],
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

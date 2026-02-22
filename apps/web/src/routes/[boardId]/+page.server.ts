import type { PageServerLoad } from './$types.js';
import type { FreePost, Board, SearchField } from '$lib/api/types.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async ({ url, params, fetch: svelteKitFetch, locals }) => {
    const boardId = params.boardId;
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 25;

    // 검색 파라미터
    const searchField = (url.searchParams.get('sfl') as SearchField) || null;
    const searchQuery = url.searchParams.get('stx') || null;
    const tag = url.searchParams.get('tag') || null;
    const isSearching = Boolean(searchField && searchQuery);
    const isTagFiltering = Boolean(tag);

    // 인증 헤더 (SSR에서 accessToken 사용)
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (locals.accessToken) {
        headers['Authorization'] = `Bearer ${locals.accessToken}`;
    }

    try {
        // 검색 쿼리 빌드
        const buildPostsUrl = (): string => {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit)
            });

            if (isSearching) {
                queryParams.set('sfl', searchField!);
                queryParams.set('stx', searchQuery!);
            }
            if (tag) {
                queryParams.set('tag', tag);
            }
            if (isTagFiltering && !isSearching) {
                queryParams.set('sfl', 'title_content');
                queryParams.set('stx', '');
            }

            return `${BACKEND_URL}/api/v1/boards/${boardId}/posts?${queryParams.toString()}`;
        };

        // 게시글 목록 (필수) + 게시판 정보/공지사항 (실패해도 페이지 표시)
        // 백엔드 API → globalThis.fetch (Origin 헤더 미포함, CORS 403 방지)
        // SvelteKit 내부 라우트 → svelteKitFetch (쿠키/상대경로 처리)
        const backendFetch = globalThis.fetch;
        const [postsResult, boardResult, noticesResult, promotionResult] = await Promise.allSettled(
            [
                // 게시글 목록
                backendFetch(buildPostsUrl(), { headers }).then(async (res) => {
                    if (!res.ok) throw new Error(`Posts API error: ${res.status}`);
                    return res.json();
                }),
                // 게시판 정보
                backendFetch(`${BACKEND_URL}/api/v1/boards/${boardId}`, { headers }).then(
                    async (res) => {
                        if (!res.ok) return null;
                        const json = await res.json();
                        return json.data as Board;
                    }
                ),
                // 공지사항 (검색 중이면 건너뜀)
                isSearching
                    ? Promise.resolve([])
                    : backendFetch(`${BACKEND_URL}/api/v1/boards/${boardId}/notices`, {
                          headers
                      }).then(async (res) => {
                          if (!res.ok) return [];
                          const json = await res.json();
                          return (json.data as FreePost[]) || [];
                      }),
                // 직접홍보 사잇광고 (SvelteKit 내부 라우트 → svelteKitFetch 사용)
                svelteKitFetch(`${url.origin}/api/ads/promotion-posts`)
                    .then((r) => r.json())
                    .catch(() => ({ success: false, data: { posts: [] } }))
            ]
        );

        // 게시글 필수 — 실패 시 에러 표시
        if (postsResult.status === 'rejected') {
            console.error('게시판 로딩 에러:', boardId, postsResult.reason);
            return {
                boardId,
                posts: [],
                notices: [],
                promotionPosts: [],
                pagination: { total: 0, page: 1, limit: 25, totalPages: 0 },
                board: null,
                searchParams: null,
                activeTag: tag,
                error: '게시글을 불러오는데 실패했습니다.'
            };
        }

        const postsData = postsResult.value;
        const posts: FreePost[] = postsData.data || [];
        const meta = postsData.meta || {};
        const total = meta.total || 0;
        const totalPages = meta.limit ? Math.ceil(meta.total / meta.limit) : 0;

        const board = boardResult.status === 'fulfilled' ? boardResult.value : null;
        const notices = noticesResult.status === 'fulfilled' ? noticesResult.value : [];
        const promotionPosts =
            promotionResult.status === 'fulfilled' ? promotionResult.value?.data?.posts || [] : [];

        return {
            boardId,
            posts,
            notices,
            promotionPosts,
            pagination: {
                total,
                page: meta.page || page,
                limit: meta.limit || limit,
                totalPages
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
                limit: 25,
                totalPages: 0
            },
            board: null,
            searchParams: null,
            activeTag: tag,
            error: '게시글을 불러오는데 실패했습니다.'
        };
    }
};

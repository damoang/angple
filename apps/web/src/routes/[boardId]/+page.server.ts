import { error as svelteError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { FreePost, Board, SearchField } from '$lib/api/types.js';
import { fetchPromotionPosts } from '$lib/server/ads/promotion.js';
import { backendFetch as bFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';

/**
 * 게시판 목록 페이지 — Streaming SSR
 *
 * board 정보: 즉시 await (헤더, SEO, 권한 체크 필요)
 * posts/notices/promotions: 스트리밍 (스켈레톤 먼저 표시)
 */
export const load: PageServerLoad = async ({ url, params, locals }) => {
    const boardId = params.boardId;
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 30;

    // 검색 파라미터
    const searchField = (url.searchParams.get('sfl') as SearchField) || null;
    const searchQuery = url.searchParams.get('stx') || null;
    const tag = url.searchParams.get('tag') || null;
    const isSearching = Boolean(searchField && searchQuery);
    const isTagFiltering = Boolean(tag);

    // 인증 헤더 (SSR에서 accessToken 사용)
    const headers = createAuthHeaders(locals.accessToken);

    // --- 1단계: board 정보 즉시 await (헤더, SEO, 권한 체크) ---
    let board: Board | null = null;
    try {
        const [boardRes, displaySettingsRes] = await Promise.all([
            bFetch(`/api/v1/boards/${boardId}`, { headers }),
            bFetch(`/api/v1/boards/${boardId}/display-settings`, { headers })
        ]);
        board = boardRes.ok ? ((await boardRes.json()).data as Board) : null;

        // display_settings 병합
        if (board && displaySettingsRes.ok) {
            const displaySettings = (await displaySettingsRes.json()).data;
            board = { ...board, display_settings: displaySettings };
        }

        // 게시판 접근 권한 체크 (list_level)
        if (board) {
            const userLevel = locals.user?.level ?? 1;
            const requiredLevel = board.list_level ?? 1;
            if (userLevel < requiredLevel) {
                svelteError(403, '이 게시판에 접근할 권한이 없습니다.');
            }
        }
    } catch (error) {
        // SvelteKit HttpError (403 등)는 다시 throw
        if (error && typeof error === 'object' && 'status' in error) {
            throw error;
        }
        console.error('게시판 정보 로딩 에러:', boardId, error);
        // board=null로 계속 진행 (게시글 목록은 시도)
    }

    // --- 2단계: posts/notices/promotions 스트리밍 (await 안 함) ---
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
        return `/api/v1/boards/${boardId}/posts?${queryParams.toString()}`;
    };

    // Promise (await 하지 않음 → SvelteKit이 스트리밍)
    const postsDataPromise = (async () => {
        const [postsResult, noticesResult, promotionResult] = await Promise.allSettled([
            bFetch(buildPostsUrl(), { headers }).then(async (res) => {
                if (!res.ok) throw new Error(`Posts API error: ${res.status}`);
                return res.json();
            }),
            isSearching
                ? Promise.resolve([])
                : bFetch(`/api/v1/boards/${boardId}/notices`, { headers }).then(async (res) => {
                      if (!res.ok) return [];
                      const json = await res.json();
                      return (json.data as FreePost[]) || [];
                  }),
            fetchPromotionPosts()
        ]);

        // 게시글
        let posts: FreePost[] = [];
        let pagination = { total: 0, page, limit, totalPages: 0 };
        let error: string | null = null;

        if (postsResult.status === 'fulfilled') {
            const postsData = postsResult.value;
            posts = postsData.data || [];
            const meta = postsData.meta || {};
            pagination = {
                total: meta.total || 0,
                page: meta.page || page,
                limit: meta.limit || limit,
                totalPages: meta.limit ? Math.ceil(meta.total / meta.limit) : 0
            };
        } else {
            console.error('게시판 로딩 에러:', boardId, postsResult.reason);
            error = '게시글을 불러오는데 실패했습니다.';
        }

        const notices = noticesResult.status === 'fulfilled' ? noticesResult.value : [];

        // 프로모션 사잇광고: board_exception에 포함된 게시판은 제외
        let promotionPosts: unknown[] = [];
        if (promotionResult.status === 'fulfilled') {
            const promoData = promotionResult.value?.data;
            const boardException = (promoData?.board_exception || '') as string;
            const excludedBoards = boardException.split(',').map((s: string) => s.trim());
            if (!excludedBoards.includes(boardId)) {
                promotionPosts = promoData?.posts || [];
            }
        }

        return { posts, notices, promotionPosts, pagination, error };
    })();

    return {
        boardId,
        board,
        searchParams: isSearching ? { field: searchField!, query: searchQuery! } : null,
        activeTag: tag,
        /** 스트리밍: Promise로 반환 → 클라이언트에서 {#await} 사용 */
        streamed: {
            postsData: postsDataPromise
        }
    };
};

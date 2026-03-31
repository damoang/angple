import { error as svelteError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { FreePost, Board, SearchField } from '$lib/api/types.js';
import {
    fetchPromotionPosts,
    fetchPromotionBoardPosts,
    isPromotionCacheWarm
} from '$lib/server/ads/promotion.js';
import type { PromotionBoardPost } from '$lib/server/ads/promotion.js';
import { backendFetch as bFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';
import { fetchMemberImagesWithTimestamp } from '$lib/server/member-images.js';
import { fetchWithdrawnMemberIds } from '$lib/server/withdrawn-members.js';
import { createCache } from '$lib/server/cache.js';
import { getCachedBoard, resolveCanonicalBoardId } from '$lib/server/board-cache.js';
import { resolveGivingMeta } from '$lib/features/giving/model.js';

// --- 인메모리 캐시: 비로그인 게시글 목록 (15초 TTL) ---
interface PostsCacheData {
    posts: FreePost[];
    notices: FreePost[];
    pagination: {
        page: number;
        limit: number;
        total?: number;
        totalPages?: number;
        hasNext?: boolean;
    };
    error: string | null;
}

const CONTENT_HEAVY_LIST_LAYOUTS = new Set([
    'detailed',
    'webzine',
    'card',
    'gallery',
    'message',
    'giving',
    'angmap',
    'angtt',
    'trade'
]);

function trimFreeListPayload(post: FreePost): FreePost {
    return {
        id: post.id,
        title: post.title,
        author: post.author,
        author_id: post.author_id,
        author_image: post.author_image,
        author_image_updated_at: post.author_image_updated_at,
        created_at: post.created_at,
        views: post.views,
        likes: post.likes,
        dislikes: post.dislikes,
        comments_count: post.comments_count,
        category: post.category,
        is_notice: post.is_notice,
        is_secret: post.is_secret,
        is_adult: post.is_adult,
        has_file: post.has_file,
        has_video: post.has_video ?? !!post.extra_9,
        has_image: post.has_image ?? !!(post.has_file || post.extra_10),
        deleted_at: post.deleted_at,
        thumbnail: post.thumbnail
    } as FreePost;
}

function maybeTrimBoardListPayload(
    boardId: string,
    board: Board | null,
    posts: FreePost[],
    notices: FreePost[]
): { posts: FreePost[]; notices: FreePost[] } {
    const listLayoutId =
        board?.display_settings?.list_layout || board?.display_settings?.list_style || 'classic';
    const shouldTrim = !CONTENT_HEAVY_LIST_LAYOUTS.has(listLayoutId);

    if (!shouldTrim) {
        return { posts, notices };
    }

    return {
        posts: posts.map(trimFreeListPayload),
        notices: notices.map(trimFreeListPayload)
    };
}

function enrichGivingPosts(posts: FreePost[]): void {
    for (const post of posts) {
        const giving = resolveGivingMeta(post);
        post.giving_start = giving.givingStart;
        post.giving_end = giving.givingEnd;
        post.giving_status = giving.status;
        post.participant_count = giving.participantCount;
        post.is_paused = giving.isPaused;
        post.is_giving_post = giving.isGivingPost;
    }
}

const postsCache = createCache<PostsCacheData>({ ttl: 15_000, maxSize: 100 });
const inFlightPostsLoads = new Map<string, Promise<PostsCacheData>>();

const DEFAULT_POSTS_TIMEOUT_MS = 12_000;
const HOT_BOARD_POSTS_TIMEOUT_MS = 8_000;

/**
 * 게시판 목록 페이지
 *
 * board 정보: 즉시 await (헤더, SEO, 권한 체크 필요)
 * posts/notices: SSR에서 완료 후 반환
 * promotions: 스트리밍 (핵심 본문과 분리)
 */
export const load: PageServerLoad = async ({ url, params, locals, getClientAddress }) => {
    const canonicalBoardId = await resolveCanonicalBoardId(params.boardId);
    if (canonicalBoardId !== params.boardId) {
        redirect(301, `/${canonicalBoardId}${url.search}`);
    }

    const boardId = canonicalBoardId;
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 24;

    // 검색 파라미터
    const searchField = (url.searchParams.get('sfl') as SearchField) || null;
    const searchQuery = url.searchParams.get('stx') || null;
    const searchSort = url.searchParams.get('sort') || null;
    const tag = url.searchParams.get('tag') || null;
    const category = url.searchParams.get('category') || null;
    const isSearching = Boolean(searchField && searchQuery);
    const isTagFiltering = Boolean(tag);
    const includeNotices = !isSearching && page === 1;

    if (isSearching && !locals.user) {
        svelteError(403, '로그인 후 검색할 수 있습니다.');
    }

    // 인증 헤더 (SSR에서 accessToken 사용)
    const headers = createAuthHeaders(locals.accessToken);

    // --- 1단계: board 정보 즉시 await (헤더, SEO, 권한 체크) ---
    // board 메타데이터는 관리자 변경 시만 바뀌므로 300초 인메모리 캐시 (board-cache.ts 공유)
    let board: Board | null = null;
    try {
        const boardResult = await getCachedBoard(boardId, headers);
        board = boardResult.board;

        if (!board) {
            if (boardResult.status === 401 || boardResult.status === 403) {
                svelteError(
                    403,
                    locals.user
                        ? '이 게시판에 접근할 권한이 없습니다.'
                        : '로그인이 필요한 게시판입니다.'
                );
            }
            svelteError(404, `'${boardId}' 게시판을 찾을 수 없습니다.`);
        }

        // 게시판 접근 권한 체크 (list_level)
        if (board) {
            const userLevel = locals.user?.level ?? 1;
            const requiredLevel = board.list_level ?? 1;
            if (userLevel < requiredLevel) {
                svelteError(
                    403,
                    locals.user
                        ? '이 게시판에 접근할 권한이 없습니다.'
                        : '로그인이 필요한 게시판입니다.'
                );
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
    // free/hello 목록은 summary 응답으로 고정해 목록 바이트를 줄인다.
    const isPromotionBoard =
        boardId === 'promotion' && !isSearching && !isTagFiltering && !category;
    const isHotBoard = boardId === 'free' || boardId === 'hello';
    const listLayoutId =
        board?.display_settings?.list_layout || board?.display_settings?.list_style || 'classic';
    const useSummaryListResponse =
        !isSearching && !CONTENT_HEAVY_LIST_LAYOUTS.has(listLayoutId) && boardId !== 'promotion';

    const buildPostsUrl = (): string => {
        const queryParams = new URLSearchParams({
            page: String(page),
            limit: String(limit)
        });
        if (isSearching) {
            queryParams.set('sfl', searchField!);
            queryParams.set('stx', searchQuery!);
            if (searchSort) {
                queryParams.set('sort', searchSort);
            }
        }
        if (tag) {
            queryParams.set('tag', tag);
        }
        if (category) {
            queryParams.set('category', category);
        }
        if (isTagFiltering && !isSearching) {
            queryParams.set('sfl', 'title_content');
            queryParams.set('stx', '');
        }
        if (useSummaryListResponse) {
            queryParams.set('summary', '1');
        }
        return `/api/v1/boards/${boardId}/posts?${queryParams.toString()}`;
    };

    // 비로그인 + 검색/태그 필터 없는 경우: 게시글 목록 캐시 사용 (15초)
    const usePostsCache = !locals.user && !isSearching && !isTagFiltering;
    const postsCacheKey = `${boardId}:p${page}:l${limit}${category ? `:c${category}` : ''}${useSummaryListResponse ? ':summary1' : ''}`;

    if (usePostsCache) {
        const cachedPosts = postsCache.get(postsCacheKey);
        if (cachedPosts) {
            return {
                boardId,
                board,
                searchParams: null,
                activeTag: null,
                postsData: cachedPosts,
                streamed: { promotionData: Promise.resolve([] as unknown[]) }
            };
        }
    }

    const buildPostsData = async (): Promise<PostsCacheData> => {
        if (isPromotionBoard) {
            // 프로모션 게시판: ads 서버에서 광고주별 제한된 게시글 조회
            const [promoBoardResult, noticesResult] = await Promise.allSettled([
                fetchPromotionBoardPosts(),
                includeNotices
                    ? bFetch(
                          `/api/v1/boards/${boardId}/notices${useSummaryListResponse ? '?summary=1' : ''}`,
                          {
                              headers,
                              timeout: 3_000,
                              bypassCircuitBreaker: true
                          }
                      ).then(async (res) => {
                          if (!res.ok) return [];
                          const json = await res.json();
                          return (json.data as FreePost[]) || [];
                      })
                    : Promise.resolve([])
            ]);

            let posts: FreePost[] = [];
            let error: string | null = null;

            if (promoBoardResult.status === 'fulfilled' && promoBoardResult.value.success) {
                const rawData = promoBoardResult.value.data;
                const pinMap = new Map(rawData.map((p) => [p.wr_id, p.pin_to_top]));
                posts = rawData.map(mapPromotionBoardPostToFreePost);
                // 최신순 정렬 (pin_to_top 우선, 그 다음 날짜 내림차순)
                posts.sort((a, b) => {
                    const aPin = pinMap.get(a.id);
                    const bPin = pinMap.get(b.id);
                    if (aPin && !bPin) return -1;
                    if (!aPin && bPin) return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
            } else {
                console.error('프로모션 게시판 로딩 에러:', promoBoardResult);
                error = '게시글을 불러오는데 실패했습니다.';
            }

            const notices = noticesResult.status === 'fulfilled' ? noticesResult.value : [];

            // 프로필 이미지 + 탈퇴 여부 enrichment
            const allPosts = [...posts, ...notices];
            if (allPosts.length > 0) {
                const mbIds = [...new Set(allPosts.map((p) => p.author_id).filter(Boolean))];
                try {
                    const [imageMap, withdrawnIds] = await Promise.all([
                        fetchMemberImagesWithTimestamp(mbIds),
                        fetchWithdrawnMemberIds(mbIds)
                    ]);
                    for (const p of allPosts) {
                        if (p.author_id && imageMap[p.author_id]) {
                            p.author_image = imageMap[p.author_id].url;
                            p.author_image_updated_at = imageMap[p.author_id].updated_at;
                        }
                        if (p.author_id && withdrawnIds.has(p.author_id)) {
                            p.is_left = true;
                        }
                    }
                } catch {
                    // ignore
                }
            }

            const pagination = {
                page: 1,
                limit: posts.length || 1,
                total: posts.length,
                totalPages: 1,
                hasNext: false
            };

            const trimmed = maybeTrimBoardListPayload(boardId, board, posts, notices);
            const result = {
                posts: trimmed.posts,
                notices: trimmed.notices,
                pagination,
                error
            };

            // 비로그인 + 에러 없는 경우만 캐시 저장
            if (usePostsCache && !error) {
                postsCache.set(postsCacheKey, result);
            }

            return result;
        }

        // 일반 게시판 (또는 프로모션 게시판 검색/태그 필터)
        const [postsResult, noticesResult] = await Promise.allSettled([
            bFetch(buildPostsUrl(), {
                headers,
                timeout: isHotBoard ? HOT_BOARD_POSTS_TIMEOUT_MS : DEFAULT_POSTS_TIMEOUT_MS,
                bypassCircuitBreaker: true
            }).then(async (res) => {
                if (!res.ok) throw new Error(`Posts API error: ${res.status}`);
                return res.json();
            }),
            includeNotices
                ? bFetch(
                      `/api/v1/boards/${boardId}/notices${useSummaryListResponse ? '?summary=1' : ''}`,
                      {
                          headers,
                          timeout: 3_000,
                          bypassCircuitBreaker: true
                      }
                  ).then(async (res) => {
                      if (!res.ok) return [];
                      const json = await res.json();
                      return (json.data as FreePost[]) || [];
                  })
                : Promise.resolve([])
        ]);

        // 게시글
        let posts: FreePost[] = [];
        let pagination: PostsCacheData['pagination'] = { page, limit, total: 0, totalPages: 0 };
        let error: string | null = null;

        if (postsResult.status === 'fulfilled') {
            const postsData = postsResult.value;
            posts = postsData.data || [];
            const meta = postsData.meta || {};
            pagination = {
                page: meta.page || page,
                limit: meta.limit || limit,
                total: typeof meta.total === 'number' ? meta.total : undefined,
                totalPages:
                    typeof meta.total === 'number' && meta.limit
                        ? Math.ceil(meta.total / meta.limit)
                        : undefined,
                hasNext: meta.has_next === true
            };
        } else {
            console.error('게시판 로딩 에러:', boardId, postsResult.reason);
            // stale-while-error: 캐시 만료된 데이터라도 에러보다 나음
            const stale = postsCache.getStale(postsCacheKey);
            if (stale) {
                return { ...stale, error: null };
            }
            error = '게시글을 불러오는데 실패했습니다.';
        }

        const notices = noticesResult.status === 'fulfilled' ? noticesResult.value : [];

        // 프로필 이미지 + 탈퇴 여부 enrichment (DB 배치 조회)
        const allPosts = [...posts, ...notices];
        if (boardId === 'giving') {
            enrichGivingPosts(allPosts);
        }
        if (allPosts.length > 0) {
            const mbIds = [...new Set(allPosts.map((p) => p.author_id).filter(Boolean))];
            try {
                const [imageMap, withdrawnIds] = await Promise.all([
                    fetchMemberImagesWithTimestamp(mbIds),
                    fetchWithdrawnMemberIds(mbIds)
                ]);
                for (const p of allPosts) {
                    if (p.author_id && imageMap[p.author_id]) {
                        p.author_image = imageMap[p.author_id].url;
                        p.author_image_updated_at = imageMap[p.author_id].updated_at;
                    }
                    if (p.author_id && withdrawnIds.has(p.author_id)) {
                        p.is_left = true;
                    }
                }
            } catch {
                // 조회 실패해도 게시글 표시는 정상 진행
            }
        }

        const trimmed = maybeTrimBoardListPayload(boardId, board, posts, notices);
        const result = {
            posts: trimmed.posts,
            notices: trimmed.notices,
            pagination,
            error
        };

        // 비로그인 + 에러 없는 경우만 캐시 저장
        if (usePostsCache && !error) {
            postsCache.set(postsCacheKey, result);
        }

        return result;
    };

    let postsDataPromise: Promise<PostsCacheData>;
    if (usePostsCache) {
        const inFlight = inFlightPostsLoads.get(postsCacheKey);
        if (inFlight) {
            postsDataPromise = inFlight;
        } else {
            postsDataPromise = buildPostsData().finally(() => {
                inFlightPostsLoads.delete(postsCacheKey);
            });
            inFlightPostsLoads.set(postsCacheKey, postsDataPromise);
        }
    } else {
        postsDataPromise = buildPostsData();
    }
    const postsData = await postsDataPromise;

    const fetchFilteredPromotionPosts = async (): Promise<unknown[]> => {
        if (isSearching || isPromotionBoard) {
            return [];
        }
        try {
            const promotionResult = await fetchPromotionPosts();
            const promoData = (promotionResult as Record<string, unknown>)?.data as
                | Record<string, unknown>
                | undefined;
            const boardException = (promoData?.board_exception || '') as string;
            const excludedBoards = boardException.split(',').map((s: string) => s.trim());
            if (excludedBoards.includes(boardId)) {
                return [];
            }
            return (promoData?.posts as unknown[]) || [];
        } catch {
            return [];
        }
    };

    // 캐시 warm → SSR 직접 포함 (스켈레톤 없음), cold → 스트리밍
    const cacheWarm = !isSearching && !isPromotionBoard && (await isPromotionCacheWarm());
    const promotionData = cacheWarm ? await fetchFilteredPromotionPosts() : null;
    const promotionDataPromise = cacheWarm ? null : fetchFilteredPromotionPosts();

    // 진실의방 워터마크 데이터 (목록 페이지)
    let watermark: { nickname: string; userId: string; clientIp: string } | null = null;
    if (boardId === 'truthroom') {
        let clientIp = '';
        try {
            clientIp = getClientAddress();
        } catch {
            clientIp = '';
        }
        watermark = {
            nickname: locals.user?.nickname || '',
            userId: locals.user?.id || '',
            clientIp
        };
    }

    return {
        boardId,
        board,
        searchParams: isSearching ? { field: searchField!, query: searchQuery! } : null,
        activeTag: tag,
        watermark,
        postsData,
        promotionData,
        streamed: {
            promotionData: promotionDataPromise ?? Promise.resolve([] as unknown[])
        }
    };
};

function mapPromotionBoardPostToFreePost(p: PromotionBoardPost): FreePost {
    return {
        id: p.wr_id,
        title: p.wr_subject,
        content: p.wr_content,
        author: p.wr_name,
        author_id: p.mb_id,
        board_id: 'promotion',
        views: p.wr_hit,
        likes: p.wr_good,
        comments_count: p.wr_comment,
        created_at: p.wr_datetime,
        has_file: p.file_count > 0,
        thumbnail: p.thumbnail || undefined,
        link1: p.wr_link1 || undefined,
        link2: p.wr_link2 || undefined
    };
}

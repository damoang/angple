import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { FreePost } from '$lib/api/types.js';
import { fetchPromotionPosts, fetchPromotionBoardPosts } from '$lib/server/ads/promotion.js';
import { transformAffiliateContent } from '$lib/hooks/builtin/affiliate.js';
import { isScraped } from '$lib/server/scrap.js';
import { backendFetch as bFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';
import { getCachedBoard } from '$lib/server/board-cache.js';
import {
    increment as incrementViewcount,
    hasRecentlyViewed,
    markViewed
} from '$lib/server/viewcount.js';
import { fetchReactionsByParentId } from '$lib/server/reactions.js';
import { fetchMemberLevels } from '$lib/server/member-levels.js';
import { fetchCommentLikeStatuses } from '$lib/server/comment-likes.js';

/**
 * 게시글 상세 페이지 — Streaming SSR
 *
 * 1단계 (즉시 await): post, board, displaySettings, files → 본문, SEO, 권한
 * 2단계 (스트리밍):   comments, promotions, revisions → 스켈레톤 먼저 표시
 */
export const load: PageServerLoad = async ({
    params,
    fetch: svelteKitFetch,
    locals,
    url,
    cookies,
    getClientAddress
}) => {
    const { boardId, postId } = params;

    // postId가 숫자인지 검증 (레거시 PHP URL 방어: /bbs/board.php 등)
    if (!/^\d+$/.test(postId)) {
        throw error(404, '잘못된 게시글 주소입니다.');
    }

    // 인증 헤더 (SSR에서 accessToken 사용)
    const headers = createAuthHeaders(locals.accessToken);

    try {
        // --- 1단계: 필수 데이터 즉시 await (본문, SEO, 권한 체크) ---
        // board는 공유 캐시(300초 TTL)에서 조회, post/files는 병렬로 fetch
        const [postResult, boardResult, filesResult] = await Promise.allSettled([
            // 게시글 (Go 백엔드 직접 호출)
            bFetch(`/api/v1/boards/${boardId}/posts/${postId}`, {
                headers,
                timeout: 5_000
            }).then(async (res) => {
                if (!res.ok) throw new Error(`Post API error: ${res.status}`);
                const json = await res.json();
                return json.data as FreePost;
            }),
            // 게시판 정보 (공유 캐시, 캐시 히트 시 0ms)
            getCachedBoard(boardId, headers),
            // 첨부 파일 (SvelteKit 내부 라우트)
            svelteKitFetch(`${url.origin}/api/boards/${boardId}/posts/${postId}/files`).then(
                async (res) => {
                    if (!res.ok) return null;
                    return res.json();
                }
            )
        ]);

        // 게시글 필수 — 실패 시 404
        if (postResult.status === 'rejected') {
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        const post = postResult.value;

        // 게시글 데이터가 null인 경우 (백엔드 응답이 { data: null })
        if (!post) {
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        // 삭제된 게시글: 에러 대신 데이터 전달 (PHP 호환: "삭제된 게시물입니다" 표시)
        if (post.deleted_at) {
            post.content = '';
        }

        let board = null;
        if (boardResult.status === 'fulfilled') {
            const br = boardResult.value;
            board = br.board;
            if (!board && (br.status === 401 || br.status === 403)) {
                throw error(
                    403,
                    locals.user
                        ? '이 게시판에 접근할 권한이 없습니다.'
                        : '로그인이 필요한 게시판입니다.'
                );
            }
        }

        // 게시판 접근 권한 체크 (list_level, read_level 중 높은 값)
        if (board) {
            const userLevel = locals.user?.level ?? 1;
            const requiredLevel = Math.max(board.list_level ?? 1, board.read_level ?? 1);
            if (userLevel < requiredLevel) {
                throw error(
                    403,
                    locals.user
                        ? '이 게시판에 접근할 권한이 없습니다.'
                        : '로그인이 필요한 게시판입니다.'
                );
            }
        }

        // 첨부 파일 데이터 병합 (본문에 이미 포함된 이미지는 제외)
        if (filesResult.status === 'fulfilled' && filesResult.value) {
            const filesData = filesResult.value;
            if (filesData.images?.length) {
                const content = post.content || '';
                post.images = filesData.images.filter((img: string) => !content.includes(img));
            }
            if (filesData.videos?.length) {
                post.videos = filesData.videos;
            }
        }

        // 본문 제휴 링크 변환은 2단계 스트리밍으로 이동 (초기 렌더 블로킹 방지)
        const affiliateContext = { bo_table: boardId, wr_id: Number(postId) };

        // 스크랩 여부는 2단계 스트리밍으로 이동 (초기 렌더 블로킹 방지)

        // 직접홍보 게시판: 활성 목록에 없는 글은 만료 처리
        let promotionExpired = false;
        if (boardId === 'promotion') {
            try {
                const promoBoard = await fetchPromotionBoardPosts();
                if (promoBoard.success && promoBoard.data.length > 0) {
                    const activeIds = new Set(promoBoard.data.map((p) => p.wr_id));
                    if (!activeIds.has(Number(postId))) {
                        promotionExpired = true;
                    }
                }
            } catch {
                // ads 서버 실패 시 만료 처리하지 않음 (안전하게)
            }
        }

        // --- 조회수 증가 (SSR에서 직접 처리, CDN 요청 제거) ---
        // 이중 방어: 1) 쿠키 기반 + 2) 서버 인메모리 IP 기반
        if (!post.deleted_at) {
            const vcKey = `${boardId}:${postId}`;
            const viewedRaw = cookies.get('viewed_posts') || '';
            const viewed = viewedRaw ? viewedRaw.split(',').filter(Boolean) : [];
            const alreadyViewedByCookie = viewed.includes(vcKey);

            // 서버 사이드 IP 기반 중복 방지 (Redis — pod 간 공유)
            let clientIp = '';
            try {
                clientIp = getClientAddress();
            } catch {
                clientIp = '';
            }
            const alreadyViewedByIp = clientIp
                ? await hasRecentlyViewed(clientIp, boardId, Number(postId))
                : false;

            if (!alreadyViewedByCookie && !alreadyViewedByIp) {
                incrementViewcount(boardId, Number(postId));
                if (clientIp) await markViewed(clientIp, boardId, Number(postId));
                viewed.push(vcKey);
                if (viewed.length > 100) viewed.splice(0, viewed.length - 100);
                cookies.set('viewed_posts', viewed.join(','), {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24
                });
            }
        }

        // --- 2단계: 보조 데이터 스트리밍 (await 안 함 → 스켈레톤 먼저 표시) ---
        const secondaryDataPromise = (async () => {
            const [
                commentsResult,
                promotionResult,
                revisionsResult,
                reactionsResult,
                likersResult,
                postContentResult,
                scrapResult
            ] = await Promise.allSettled([
                // 댓글 (SvelteKit 내부 라우트 → svelteKitFetch)
                svelteKitFetch(
                    `${url.origin}/api/boards/${boardId}/posts/${postId}/comments?page=1&limit=200`
                ).then(async (res) => {
                    if (!res.ok)
                        return { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };
                    const json = await res.json();
                    if (!json.success)
                        return { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };
                    const data = json.data;
                    return {
                        items: data.comments || [],
                        total: data.total || 0,
                        page: data.page || 1,
                        limit: data.limit || 200,
                        total_pages: data.total_pages || 1
                    };
                }),
                // 직접홍보 사잇광고 (ads 서버 직접 호출 + 캐시)
                fetchPromotionPosts(),
                // 리비전 히스토리 (관리자 level ≥ 10일 때만)
                (locals.user?.level ?? 0) >= 10
                    ? bFetch(`/api/v1/boards/${boardId}/posts/${postId}/revisions`, {
                          headers,
                          timeout: 3_000
                      }).then(async (res) => {
                          if (!res.ok) return [];
                          const json = await res.json();
                          return json.data || [];
                      })
                    : Promise.resolve([]),
                // 리액션 일괄 조회 (게시글 + 모든 댓글, DB 직접 호출 — CDN 요청 제거)
                fetchReactionsByParentId(
                    `document:${boardId}:${postId}`,
                    locals.user?.id || ''
                ).catch(() => ({}) as Record<string, unknown>),
                // 추천자 아바타 상위 5명 (Go 백엔드 직접 호출 — CDN 요청 제거)
                bFetch(`/api/v1/boards/${boardId}/posts/${postId}/likers?page=1&limit=5`, {
                    headers,
                    timeout: 3_000
                })
                    .then(async (res) => {
                        if (!res.ok) return { likers: [], total: 0 };
                        const json = await res.json();
                        return json.data || { likers: [], total: 0 };
                    })
                    .catch(() => ({ likers: [], total: 0 })),
                // 본문 제휴 링크 변환 (스트리밍 — 초기 렌더 블로킹 방지)
                post.content
                    ? Promise.race([
                          transformAffiliateContent(post.content, affiliateContext),
                          new Promise<string>((_, reject) =>
                              setTimeout(() => reject(new Error('timeout')), 3000)
                          )
                      ]).catch(() => null)
                    : Promise.resolve(null),
                // 스크랩 여부 (로그인 시만, 스트리밍 — 초기 렌더 블로킹 방지)
                locals.user?.id
                    ? isScraped(locals.user.id, boardId, postId).catch(() => false)
                    : Promise.resolve(false)
            ]);

            const comments =
                commentsResult.status === 'fulfilled'
                    ? commentsResult.value
                    : { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };

            // 댓글 제휴 링크 서버사이드 변환
            if (comments.items?.length) {
                try {
                    const transformPromises: Promise<void>[] = [];
                    for (const comment of comments.items) {
                        if (comment.content) {
                            transformPromises.push(
                                transformAffiliateContent(comment.content, affiliateContext).then(
                                    (html) => {
                                        comment.content = html;
                                    }
                                )
                            );
                        }
                    }
                    if (transformPromises.length > 0) {
                        await Promise.race([
                            Promise.allSettled(transformPromises),
                            new Promise((resolve) => setTimeout(resolve, 3000))
                        ]);
                    }
                } catch {
                    // 변환 실패 시 원본 유지
                }
            }

            // 프로모션 사잇광고: board_exception에 포함된 게시판은 제외
            let promotionPosts: unknown[] = [];
            if (promotionResult.status === 'fulfilled') {
                const promoData = (promotionResult.value as Record<string, unknown>)?.data as
                    | Record<string, unknown>
                    | undefined;
                const boardException = (promoData?.board_exception || '') as string;
                const excludedBoards = boardException.split(',').map((s: string) => s.trim());
                if (!excludedBoards.includes(boardId)) {
                    promotionPosts = (promoData?.posts as unknown[]) || [];
                }
            }

            const revisions =
                revisionsResult.status === 'fulfilled' ? revisionsResult.value || [] : [];

            const reactions =
                reactionsResult.status === 'fulfilled' ? reactionsResult.value || {} : {};

            const likersData =
                likersResult.status === 'fulfilled'
                    ? likersResult.value || { likers: [], total: 0 }
                    : { likers: [], total: 0 };

            // 회원 레벨 배치 조회 (작성자 + 댓글 작성자, DB 직접 — CDN 요청 제거)
            let memberLevels: Record<string, number> = {};
            try {
                const authorIds = new Set<string>();
                if (post.author_id) authorIds.add(post.author_id);
                for (const c of comments.items || []) {
                    if (c.author_id) authorIds.add(c.author_id);
                }
                if (authorIds.size > 0) {
                    memberLevels = await fetchMemberLevels([...authorIds]);
                }
            } catch {
                // 레벨 조회 실패 시 빈 맵 (클라이언트에서 fallback)
            }

            // 댓글 좋아요/비추천 상태 배치 조회 (로그인 시만)
            let commentLikeStatuses: { likedIds: number[]; dislikedIds: number[] } = {
                likedIds: [],
                dislikedIds: []
            };
            if (locals.user?.id && comments.items?.length) {
                try {
                    const commentIds = comments.items
                        .map((c: { id: number | string }) => Number(c.id))
                        .filter((id: number) => !isNaN(id));
                    commentLikeStatuses = await fetchCommentLikeStatuses(
                        boardId,
                        commentIds,
                        locals.user.id
                    );
                } catch {
                    // 실패 시 빈 상태 (클라이언트에서 fallback)
                }
            }

            // 본문 제휴 링크 변환 결과
            const transformedPostContent =
                postContentResult.status === 'fulfilled' ? postContentResult.value : null;

            const isScrapped = scrapResult.status === 'fulfilled' ? scrapResult.value : false;

            return {
                comments,
                promotionPosts,
                revisions,
                reactions,
                likersData,
                memberLevels,
                commentLikeStatuses,
                transformedPostContent,
                isScrapped
            };
        })();

        // 워터마크 대상 게시판: 열람자 정보 전달
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
            post,
            board,
            isScrapped: false,
            promotionExpired,
            watermark,
            /** 스트리밍: Promise로 반환 → 클라이언트에서 $effect로 수신 */
            streamed: {
                secondaryData: secondaryDataPromise
            }
        };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // SvelteKit error() already thrown
        }
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};

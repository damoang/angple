import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { FreePost } from '$lib/api/types.js';
import { fetchPromotionPosts, fetchPromotionBoardPosts } from '$lib/server/ads/promotion.js';
import {
    applyAffiliateField,
    fetchPostAffiliateLinks,
    findAffiliateFieldRow,
    renderAffiliateContent
} from '$lib/server/affiliate-links.js';
import { isLinkProcessingPluginEnabled } from '$lib/server/link-processing/runtime.js';
import { isScraped } from '$lib/server/scrap.js';
import { backendFetch as bFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';
import { isRestrictedUser, type AuthUser } from '$lib/server/auth/index.js';
import { getCachedBoard, resolveCanonicalBoardId } from '$lib/server/board-cache.js';
import {
    increment as incrementViewcount,
    hasRecentlyViewed,
    markViewed
} from '$lib/server/viewcount.js';
import { fetchReactionsByParentId } from '$lib/server/reactions.js';
import { fetchMemberImagesWithTimestamp } from '$lib/server/member-images.js';
import { fetchCommentLikeStatuses } from '$lib/server/comment-likes.js';

import { fetchPostLikeStatus } from '$lib/server/post-like-status.js';
import { fetchTruthroomPostId, fetchTruthroomCommentMap } from '$lib/server/truthroom.js';
import { BackendUnavailableError } from '$lib/server/backend-fetch.js';

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
    getClientAddress,
    setHeaders
}) => {
    const postId = params.postId;
    const canonicalBoardId = await resolveCanonicalBoardId(params.boardId);
    if (canonicalBoardId !== params.boardId) {
        redirect(301, `/${canonicalBoardId}/${postId}${url.search}`);
    }

    const boardId = canonicalBoardId;
    const initialCommentsLimit = 10;
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
                timeout: 5_000,
                bypassCircuitBreaker: true
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
            const reason = postResult.reason;
            if (reason instanceof BackendUnavailableError) {
                throw error(503, reason.message);
            }
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        const post = postResult.value;

        // 게시글 데이터가 null인 경우 (백엔드 응답이 { data: null })
        if (!post) {
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        // 삭제된 게시글: 본문 숨김 + 검색엔진 색인 차단
        if (post.deleted_at) {
            post.content = '';
            setHeaders({ 'X-Robots-Tag': 'noindex, noarchive' });
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
            if (filesData.files?.length) {
                post.files = filesData.files;
            }
            if (filesData.downloads?.length) {
                post.downloads = filesData.downloads;
            }
        }

        // 게시글 작성자 프로필 이미지 즉시 조회 (1단계 — 본문 렌더에 필요)
        if (post.author_id && !post.author_image) {
            try {
                const imgMap = await fetchMemberImagesWithTimestamp([post.author_id]);
                if (imgMap[post.author_id]) {
                    post.author_image = imgMap[post.author_id].url;
                    post.author_image_updated_at = imgMap[post.author_id].updated_at;
                }
            } catch {
                // 실패해도 정상 진행
            }
        }

        // 본문 제휴 링크 변환은 2단계 스트리밍으로 이동 (초기 렌더 블로킹 방지)
        const affiliateContext = { bo_table: boardId, wr_id: Number(postId) };
        const affiliateEnabled = await isLinkProcessingPluginEnabled().catch(() => false);
        const postAffiliateRows = affiliateEnabled
            ? await fetchPostAffiliateLinks(boardId, Number(postId)).catch(() => [])
            : [];

        // 링크1/링크2는 본문/댓글 Hook를 타지 않으므로 별도 제휴 변환한다.
        if (post.link1 || post.link2) {
            try {
                const [link1Result, link2Result] = await Promise.race([
                    Promise.allSettled([
                        post.link1 ? Promise.resolve(post.link1) : Promise.resolve(null),
                        post.link2 ? Promise.resolve(post.link2) : Promise.resolve(null)
                    ]),
                    new Promise<PromiseSettledResult<string | null>[]>((resolve) =>
                        setTimeout(() => resolve([]), 1500)
                    )
                ]);

                if (link1Result?.status === 'fulfilled') {
                    const row = findAffiliateFieldRow(postAffiliateRows, 'post_link1');
                    const originalLink = post.link1;
                    if (originalLink) {
                        const result = applyAffiliateField(originalLink, row);
                        if (result.href !== originalLink) {
                            post.link1_display = result.displayUrl;
                            post.link1 = result.href;
                            post.link1_affiliate = result.affiliate;
                        }
                    }
                }

                if (link2Result?.status === 'fulfilled') {
                    const row = findAffiliateFieldRow(postAffiliateRows, 'post_link2');
                    const originalLink = post.link2;
                    if (originalLink) {
                        const result = applyAffiliateField(originalLink, row);
                        if (result.href !== originalLink) {
                            post.link2_display = result.displayUrl;
                            post.link2 = result.href;
                            post.link2_affiliate = result.affiliate;
                        }
                    }
                }
            } catch {
                // 변환 실패 시 원본 링크 유지
            }
        }

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

        // --- 2단계: 핵심/보조 데이터를 분리해 스트리밍 ---
        const commentsData = await (async () => {
            const commentsResult = await svelteKitFetch(
                `${url.origin}/api/boards/${boardId}/posts/${postId}/comments?page=1&limit=${initialCommentsLimit}`
            ).then(async (res) => {
                if (!res.ok)
                    return {
                        items: [],
                        total: 0,
                        page: 1,
                        limit: initialCommentsLimit,
                        total_pages: 0
                    };
                const json = await res.json();
                if (!json.success)
                    return {
                        items: [],
                        total: 0,
                        page: 1,
                        limit: initialCommentsLimit,
                        total_pages: 0
                    };
                const data = json.data;
                return {
                    items: data.comments || [],
                    total: data.total || 0,
                    page: data.page || 1,
                    limit: data.limit || initialCommentsLimit,
                    total_pages: data.total_pages || 1
                };
            });

            const comments = commentsResult;

            // 프로필 이미지 배치 조회 (DB mb_image_url)
            try {
                const imgIds = new Set<string>();
                if (post.author_id) imgIds.add(post.author_id);
                for (const c of comments.items || []) {
                    if (c.author_id) imgIds.add(c.author_id);
                }
                if (imgIds.size > 0) {
                    const imageMap = await fetchMemberImagesWithTimestamp([...imgIds]);
                    if (post.author_id && imageMap[post.author_id]) {
                        post.author_image = imageMap[post.author_id].url;
                        post.author_image_updated_at = imageMap[post.author_id].updated_at;
                    }
                    for (const c of comments.items || []) {
                        if (c.author_id && imageMap[c.author_id]) {
                            c.author_image = imageMap[c.author_id].url;
                            c.author_image_updated_at = imageMap[c.author_id].updated_at;
                        }
                    }
                }
            } catch {
                // 이미지 조회 실패해도 정상 진행
            }

            return {
                comments
            };
        })();

        const auxiliaryDataPromise = (async () => {
            const [
                promotionResult,
                reactionsResult,
                postContentResult,
                scrapResult,
                postReportCountResult,
                postLikeStatusResult,
                scheduledDeleteResult,
                commentLikeStatusesResult,
                truthroomCommentMapResult
            ] = await Promise.allSettled([
                // 직접홍보 사잇광고 (ads 서버 직접 호출 + 캐시)
                fetchPromotionPosts(),
                // 리액션 일괄 조회 (게시글 + 모든 댓글, DB 직접 호출 — CDN 요청 제거)
                fetchReactionsByParentId(
                    `document:${boardId}:${postId}`,
                    locals.user?.id || ''
                ).catch(() => ({}) as Record<string, unknown>),
                // 본문 제휴 링크 변환 (스트리밍 — 초기 렌더 블로킹 방지)
                Promise.resolve(
                    affiliateEnabled && post.content
                        ? renderAffiliateContent(post.content, postAffiliateRows, 'post_body')
                        : null
                ),
                // 스크랩 여부 (로그인 시만, 스트리밍 — 초기 렌더 블로킹 방지)
                locals.user?.id
                    ? isScraped(locals.user.id, boardId, postId).catch(() => false)
                    : Promise.resolve(false),
                // 게시글 신고 횟수 (관리 기능은 /admin에서)
                Promise.resolve(null),
                // 게시글 추천/비추천 상태 (로그인 시만, DB 직접 조회)
                locals.user?.id
                    ? fetchPostLikeStatus(boardId, Number(postId), locals.user.id).catch(() => ({
                          userLiked: false,
                          userDisliked: false
                      }))
                    : Promise.resolve({ userLiked: false, userDisliked: false }),
                // 삭제 예약 상태 조회 (Go 백엔드)
                bFetch(`/api/v1/boards/${boardId}/posts/${postId}/delete-status`, {
                    headers,
                    timeout: 2_000
                })
                    .then(async (res) => {
                        if (!res.ok) return null;
                        const json = await res.json();
                        if (json.scheduled) {
                            return {
                                scheduled: true,
                                scheduled_at: json.scheduled_at,
                                requested_at: json.requested_at,
                                delay_minutes: json.delay_minutes
                            };
                        }
                        return null;
                    })
                    .catch(() => null),
                (() => {
                    if (!locals.user?.id || !commentsData.comments.items?.length) {
                        return Promise.resolve({ likedIds: [], dislikedIds: [] });
                    }
                    const commentIds = commentsData.comments.items
                        .map((c: { id: number | string }) => Number(c.id))
                        .filter((id: number) => !isNaN(id));
                    if (commentIds.length === 0) {
                        return Promise.resolve({ likedIds: [], dislikedIds: [] });
                    }
                    return fetchCommentLikeStatuses(boardId, commentIds, locals.user.id).catch(
                        () => ({
                            likedIds: [],
                            dislikedIds: []
                        })
                    );
                })(),
                (() => {
                    if (!commentsData.comments.items?.length) {
                        return Promise.resolve({});
                    }
                    const lockedCommentIds = commentsData.comments.items
                        .filter((c: { report_count: string | number }) => c.report_count === 'lock')
                        .map((c: { id: number | string }) => Number(c.id))
                        .filter((id: number) => !isNaN(id) && id > 0);
                    if (lockedCommentIds.length === 0) {
                        return Promise.resolve({});
                    }
                    return fetchTruthroomCommentMap(boardId, postId, lockedCommentIds).catch(
                        () => ({})
                    );
                })()
            ]);

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

            const reactions =
                reactionsResult.status === 'fulfilled' ? reactionsResult.value || {} : {};

            // 본문 제휴 링크 변환 결과
            const transformedPostContent =
                postContentResult.status === 'fulfilled' ? postContentResult.value : null;

            const isScrapped = scrapResult.status === 'fulfilled' ? scrapResult.value : false;

            const postReportCount =
                postReportCountResult.status === 'fulfilled' ? postReportCountResult.value : null;

            const postLikeStatus =
                postLikeStatusResult.status === 'fulfilled'
                    ? postLikeStatusResult.value
                    : { userLiked: false, userDisliked: false };

            const scheduledDelete =
                scheduledDeleteResult.status === 'fulfilled' ? scheduledDeleteResult.value : null;

            const commentLikeStatuses =
                commentLikeStatusesResult.status === 'fulfilled'
                    ? commentLikeStatusesResult.value
                    : { likedIds: [], dislikedIds: [] };

            const truthroomCommentMap =
                truthroomCommentMapResult.status === 'fulfilled'
                    ? truthroomCommentMapResult.value
                    : {};

            return {
                promotionPosts,
                reactions,
                transformedPostContent,
                isScrapped,
                postReportCount,
                postLikeStatus,
                scheduledDelete,
                commentLikeStatuses,
                truthroomCommentMap
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

        // 잠긴 게시글 → 진실의방 글 ID 조회
        let truthroomPostId: number | null = null;
        if (post.extra_7 === 'lock') {
            truthroomPostId = await fetchTruthroomPostId(boardId, postId);
        }

        // 진실의방 글 → 원본 게시글/댓글 링크
        let originalPostLink: {
            boardId: string;
            postId: string;
            commentId?: string;
        } | null = null;
        if (boardId === 'truthroom' && post.extra_1 && post.extra_2) {
            originalPostLink = { boardId: post.extra_1, postId: post.extra_2 };
            if (post.extra_3) {
                originalPostLink.commentId = post.extra_3;
            }
        }

        return {
            boardId,
            post,
            board,
            commentsData,
            isScrapped: false,
            isRestricted: isRestrictedUser(locals.user as AuthUser | null),
            promotionExpired,
            watermark,
            truthroomPostId,
            originalPostLink,
            /** 스트리밍: Promise로 반환 → 클라이언트에서 $effect로 수신 */
            streamed: {
                auxiliaryData: auxiliaryDataPromise
            }
        };
    } catch (err) {
        if (err instanceof BackendUnavailableError) {
            throw error(503, err.message);
        }
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // SvelteKit error() already thrown
        }
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};

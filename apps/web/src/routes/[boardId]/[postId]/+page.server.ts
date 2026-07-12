import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { Board, FreePost } from '$lib/api/types.js';
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
import { addReadPost } from '$lib/server/read-posts.js';
import { fetchReactionsByParentId } from '$lib/server/reactions.js';
import { fetchMemberImagesWithTimestamp } from '$lib/server/member-images.js';
import { fetchCommentLikeStatuses } from '$lib/server/comment-likes.js';

import { fetchPostLikeStatus } from '$lib/server/post-like-status.js';
import { fetchMemberActivity, type MemberActivity } from '$lib/server/member-activity.js';
import { fetchWithdrawnMemberIds } from '$lib/server/withdrawn-members.js';
import { fetchTruthroomPostId, fetchTruthroomCommentMap } from '$lib/server/truthroom.js';
import { BackendUnavailableError } from '$lib/server/backend-fetch.js';
import { applyFilter } from '$lib/hooks/registry.js';
import { buildHookContext } from '$lib/hooks/context.js';
import { prefetchBlueskyDIDs } from '$lib/server/bluesky/transform.js';

/**
 * 게시글 상세 페이지 — Streaming SSR
 *
 * 1단계 (즉시 await): post, board, displaySettings, files → 본문, SEO, 권한
 * 2단계 (스트리밍):   comments, promotions, revisions → 스켈레톤 먼저 표시
 */

type DetailBoardPayload = Pick<
    Board,
    | 'board_id'
    | 'subject'
    | 'name'
    | 'read_level'
    | 'write_level'
    | 'reply_level'
    | 'comment_level'
    | 'upload_level'
    | 'download_level'
    | 'use_nogood'
    | 'display_settings'
    | 'permissions'
    | 'board_type'
    | 'use_sns'
>;

function toDetailBoardPayload(board: Board | null): DetailBoardPayload | null {
    if (!board) return null;

    return {
        board_id: board.board_id,
        subject: board.subject,
        name: board.name,
        read_level: board.read_level,
        write_level: board.write_level,
        reply_level: board.reply_level,
        comment_level: board.comment_level,
        upload_level: board.upload_level,
        download_level: board.download_level,
        use_nogood: board.use_nogood,
        display_settings: board.display_settings,
        permissions: board.permissions,
        board_type: board.board_type,
        use_sns: board.use_sns
    };
}

export const load: PageServerLoad = async ({
    params,
    fetch: svelteKitFetch,
    locals,
    url,
    cookies,
    getClientAddress,
    setHeaders,
    isDataRequest
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
                // 2초: 5초는 백엔드 장애 시 사용자 체감 대기를 과도하게 늘림.
                // 실패 분기(BackendUnavailableError → 503, 그 외 → 404)는 기존 동일.
                timeout: 2_000,
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

        // 삭제된 게시글: 본문+메타데이터 숨김 + 검색엔진 색인 차단
        if (post.deleted_at) {
            post.content = '';
            post.tags = [];
            post.link1 = '';
            post.link2 = '';
            post.images = [];
            post.videos = [];
            post.downloads = [];
            post.files = [];
            // 삭제글은 댓글도 노출하지 않는다(#12711). 댓글 API(부모 삭제 시 빈 배열 반환)와
            // 정합을 맞추기 위해 권위 카운트도 0으로 — 헤더 카운트 라벨/SSR total/클라 backfill 게이트 일치.
            post.comments_count = 0;
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

        // Bluesky handle → DID prefetch (#12050).
        // content-transform 직전에 본문 내 `bsky.app/profile/<handle>/post/<id>`
        // URL 의 handle 을 DID 로 일괄 치환. 실패 시 원본 유지 → UX 악화 없음.
        if (post.content) {
            try {
                post.content = await prefetchBlueskyDIDs(post.content);
            } catch (e) {
                // graceful degradation — 본문 보존, 운영 모니터링용 로그만.
                console.warn('[bluesky] prefetchBlueskyDIDs(post) failed:', e);
            }
        }

        // 마음메시지(message) 게시판: 익명 글 프로필 정보 숨김
        if (boardId === 'message' && !post.author) {
            post.author_image = undefined;
            post.author_image_updated_at = undefined;
            post.author_id = '';
            post.author = '익명';
        }

        // 작성자 최근 활동 — 단일 fetch 를 여기서 시작해 두 소비처에서 재사용:
        // (1) SEO 내부링크 섹션(#83): return 직전 await → SSR HTML 앵커로 포함
        // (2) 작성자 활동 패널: streamed auxiliaryData 로 전달 (기존 동작 유지)
        // 탈퇴 회원은 활동 비노출 — 프록시(/api/members/[id]/activity)와 동일 가드.
        // fetchMemberActivity 는 내부 catch + 2s 타임아웃이라 절대 reject 하지 않는다.
        const emptyActivity: MemberActivity = { recentPosts: [], recentComments: [] };
        const memberActivityPromise: Promise<MemberActivity> = (async () => {
            if (!post.author_id) return emptyActivity;
            try {
                const withdrawn = await fetchWithdrawnMemberIds([post.author_id]);
                if (withdrawn.has(post.author_id)) return emptyActivity;
                return await fetchMemberActivity(post.author_id, 5);
            } catch {
                return emptyActivity;
            }
        })();

        // 게시글 작성자 프로필 이미지 즉시 조회 (1단계 — 본문 렌더에 필요)
        // 작성자 탈퇴 여부 — 닉네임 취소선 표시용(5분 캐시라 활동 게이트 조회와 중복돼도 저렴).
        if (post.author_id) {
            try {
                const w = await fetchWithdrawnMemberIds([post.author_id]);
                post.is_left = w.has(post.author_id);
            } catch {
                // 실패 시 취소선만 생략
            }
        }

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

        // 본문/링크 제휴 변환은 auxiliaryDataPromise(2단계 스트리밍) 로 이동.
        // 1단계에서 isLinkProcessingPluginEnabled + fetchPostAffiliateLinks 2회 DB 왕복으로
        // 본문 렌더가 블로킹되던 문제 해소. 클라이언트는 streamed 결과 도착 시 link 값을 업데이트.
        // 스크랩 여부도 2단계 스트리밍에 포함 (초기 렌더 블로킹 방지)

        // 직접홍보 게시판: 활성 광고주가 아닌 글은 만료 처리 (공지글 제외)
        let promotionExpired = false;
        const promotionExemptPosts = new Set([181367, 180884]);
        if (boardId === 'promotion' && !post.is_notice && !promotionExemptPosts.has(post.id)) {
            try {
                const promoBoard = await fetchPromotionBoardPosts();
                if (promoBoard.success && promoBoard.data.length > 0) {
                    // 활성 광고주의 mb_id 목록으로 체크 (post_count 제한 무관)
                    const activeMbIds = new Set(promoBoard.data.map((p) => p.mb_id));
                    if (!activeMbIds.has(post.author_id)) {
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
                // __data.json 응답에서는 Set-Cookie 생략 → nginx SSR 캐시 허용
                // HTML 요청에서만 쿠키 설정 (IP 기반 dedup이 SPA 네비게이션 커버)
                if (!isDataRequest) {
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

            // 로그인 회원 read-set(L2, Redis) 기록 — 크로스기기 읽음 표시용.
            // fire-and-forget: 응답에 쓰이지 않으므로 로드 지연을 피하려 await 하지 않음.
            // best-effort(내부 try/catch), ZADD 멱등이라 재진입 시 재기록해도 무해.
            if (locals.user?.id) {
                void addReadPost(locals.user.id, boardId, Number(postId));
            }
        }

        // --- 2단계: 핵심/보조 데이터를 분리해 스트리밍 ---
        const commentsData = await (async () => {
            if (isDataRequest && !locals.user?.id) {
                // 비로그인 SPA 네비(__data.json): 댓글은 클라가 backfill 로 로드. total 은 권위값 보존.
                // 비로그인 __data.json 은 nginx/SSR 캐시 대상이라 댓글을 비워 stale 캐시를 방지.
                // 로그인 유저는 응답이 private(캐시 우회)이므로 아래에서 댓글을 SSR 에 포함 →
                // SPA 이동 시 클라 재요청(스켈레톤) 없이 즉시 노출 (캐시 정합성 영향 없음).
                return {
                    comments: {
                        items: [],
                        total: post.comments_count ?? 0,
                        page: 1,
                        limit: initialCommentsLimit,
                        total_pages:
                            (post.comments_count ?? 0) > 0
                                ? Math.ceil((post.comments_count ?? 0) / initialCommentsLimit)
                                : 0,
                        loadState: ((post.comments_count ?? 0) > 0 ? 'partial' : 'complete') as
                            | 'complete'
                            | 'partial'
                            | 'failed',
                        edit_policy: undefined as
                            | { cost: number; grace_seconds: number }
                            | undefined
                    }
                };
            }

            // 댓글 SSR 로드. 핵심 계약(#12663·#12668):
            // - total 은 항상 "글의 권위 있는 댓글 수"(post.comments_count). SSR fetch 가
            //   실패/타임아웃해도 0 으로 덮지 않는다 → 클라 backfill 이 확실히 발화.
            // - loadState 로 complete/partial/failed 를 명시 → 클라 backfill 게이트가
            //   total<=loaded 산술(0/0 함정) 대신 이 신호에 기반.
            // - 실패는 무성으로 삼키지 않고 구조적 로그로 노출(재발 조기탐지).
            const expectedTotal = post.comments_count ?? 0;
            const ssrStart = Date.now();
            const warnFail = (reason: string, status?: number) =>
                console.warn('[comments-ssr] fetch failed', {
                    boardId,
                    postId,
                    reason,
                    status,
                    expectedTotal,
                    durationMs: Date.now() - ssrStart
                });
            // 실패/타임아웃 시에도 total 은 권위값(expectedTotal=post.comments_count) 보존 +
            // loadState='failed'. total:0 으로 덮으면 클라 backfill 게이트가 0/0 으로 막혀
            // 자가복구 불가(#12663·#12668). items 는 union 추론으로 any 소비 유지(다운스트림 호환).
            const failedMeta = () => ({
                items: [] as never[],
                total: expectedTotal,
                page: 1,
                limit: initialCommentsLimit,
                total_pages:
                    expectedTotal > 0 ? Math.ceil(expectedTotal / initialCommentsLimit) : 0,
                loadState: 'failed' as 'complete' | 'partial' | 'failed',
                edit_policy: undefined as { cost: number; grace_seconds: number } | undefined
            });
            // svelteKitFetch 는 표준 platform fetch(timeout 옵션 미지원) → AbortSignal.timeout 으로
            // 2.5s 상한. 초과/네트워크 오류는 .catch → failedMeta 로 일관 처리(무제한 대기 차단).
            const commentsResult = await svelteKitFetch(
                `${url.origin}/api/boards/${boardId}/posts/${postId}/comments?page=1&limit=${initialCommentsLimit}`,
                { signal: AbortSignal.timeout(2_500) }
            )
                .then(async (res) => {
                    if (!res.ok) {
                        warnFail('http_error', res.status);
                        return failedMeta();
                    }
                    const json = await res.json();
                    if (!json.success) {
                        warnFail('not_success');
                        return failedMeta();
                    }
                    const data = json.data;
                    const items = data.comments || [];
                    const total = data.total || items.length;
                    return {
                        items,
                        total,
                        page: data.page || 1,
                        limit: data.limit || initialCommentsLimit,
                        total_pages: data.total_pages || 1,
                        loadState: (items.length >= total ? 'complete' : 'partial') as
                            | 'complete'
                            | 'partial'
                            | 'failed',
                        edit_policy: json.meta?.comment_edit_policy as
                            | { cost: number; grace_seconds: number }
                            | undefined
                    };
                })
                .catch(() => {
                    warnFail('timeout_or_network');
                    return failedMeta();
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
            // 제휴 변환에 필요한 plugin flag + row 를 이 스트리밍 단계에서 조회.
            // (이전에는 1단계에서 await 하여 본문 SSR 을 블로킹)
            const affiliateEnabled = await isLinkProcessingPluginEnabled().catch(() => false);
            const postAffiliateRows = affiliateEnabled
                ? await fetchPostAffiliateLinks(boardId, Number(postId)).catch(() => [])
                : [];

            // link1/link2 제휴 변환 결과 계산 (post 객체는 mutate 하지 않고 별도 payload 로 전달).
            const linkAffiliate: {
                link1?: string;
                link2?: string;
                link1_display?: string;
                link2_display?: string;
                link1_affiliate?: boolean;
                link2_affiliate?: boolean;
            } = {};
            if (post.link1) {
                const row = findAffiliateFieldRow(postAffiliateRows, 'post_link1');
                const result = applyAffiliateField(post.link1, row);
                if (result.href !== post.link1) {
                    linkAffiliate.link1 = result.href;
                    linkAffiliate.link1_display = result.displayUrl;
                    linkAffiliate.link1_affiliate = result.affiliate;
                }
            }
            if (post.link2) {
                const row = findAffiliateFieldRow(postAffiliateRows, 'post_link2');
                const result = applyAffiliateField(post.link2, row);
                if (result.href !== post.link2) {
                    linkAffiliate.link2 = result.href;
                    linkAffiliate.link2_display = result.displayUrl;
                    linkAffiliate.link2_affiliate = result.affiliate;
                }
            }

            const [
                promotionResult,
                reactionsResult,
                postContentResult,
                scrapResult,
                postReportCountResult,
                postLikeStatusResult,
                scheduledDeleteResult,
                commentLikeStatusesResult,
                truthroomCommentMapResult,
                memberActivityResult
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
                // 삭제 예약 상태 — Posts API 응답에 inline 포함 (별도 fetch 제거, 백엔드 PR #430)
                Promise.resolve(
                    post.scheduled_delete
                        ? {
                              scheduled: true,
                              scheduled_at: post.scheduled_delete.scheduled_at,
                              requested_at: post.scheduled_delete.requested_at,
                              delay_minutes: post.scheduled_delete.delay_minutes
                          }
                        : null
                ),
                (() => {
                    if (!locals.user?.id) {
                        return Promise.resolve({ likedIds: [], dislikedIds: [] });
                    }
                    // 글 단위 조회 — SSR 1페이지(10개) 밖 backfill 댓글의 하트 토글 상태
                    // 누락 방지 (economy/77128 제보: 정렬 동률로 1페이지에서 밀린 댓글의
                    // 좋아요가 새로고침 후 미표시되던 문제)
                    return fetchCommentLikeStatuses(boardId, Number(postId), locals.user.id).catch(
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
                })(),
                // 작성자 최근 활동 (SSR 직접 조회 — 클릭 없이 표시, 클라이언트 API 요청 제거)
                // 1단계에서 시작한 단일 fetch 재사용 (SEO 섹션 #83 과 공유, 중복 호출 방지)
                memberActivityPromise
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

            const memberActivity =
                memberActivityResult.status === 'fulfilled'
                    ? memberActivityResult.value
                    : { recentPosts: [], recentComments: [] };

            return {
                promotionPosts,
                reactions,
                transformedPostContent,
                isScrapped,
                postReportCount,
                postLikeStatus,
                scheduledDelete,
                commentLikeStatuses,
                truthroomCommentMap,
                linkAffiliate,
                memberActivity
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

        // #12920: 이용제한 근거 글·댓글 [보기] 공개 시 전체화면 워터마크용 열람자 정보.
        // 로그인 사용자에게만 발급 — 익명 SSR/데이터 캐시 응답에 IP 가 잔존하지 않게 한다.
        let disciplineViewer: { nickname: string; userId: string; clientIp: string } | null = null;
        if (locals.user) {
            let clientIp = '';
            try {
                clientIp = getClientAddress();
            } catch {
                clientIp = '';
            }
            disciplineViewer = {
                nickname: locals.user.nickname || '',
                userId: locals.user.id || '',
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

        // 하단 게시글 목록은 클라이언트에서 로드한다 (items 는 비워두어 __data.json 최소화).
        // #12430 fix: URL `?page=N` 있으면 그 값, 없으면 SSR 단계에서 page-index 호출하여
        // 자기 글이 속한 페이지를 자동 결정. 이전에 SSR=1 로 고정 후 클라이언트 onMount 에서
        // 보강하던 방식이 race / hydration 문제로 1페이지에 고정되는 회귀가 반복됨 (#12430).
        // items 는 SSR 에서 비워두므로 #12315 의 "특정 날짜 글 고정 노출" 회귀와는 무관.
        const urlPage = Number(url.searchParams.get('page')) || 0;
        let recentPostsPage = urlPage > 0 ? urlPage : 1;

        if (urlPage === 0 && !post.deleted_at) {
            try {
                const piRes = await svelteKitFetch(
                    `/api/boards/${boardId}/posts/${postId}/page-index`
                );
                if (piRes.ok) {
                    const body = (await piRes.json()) as { page?: number };
                    if (body.page && body.page > 1) {
                        recentPostsPage = body.page;
                    }
                }
            } catch {
                // page-index 실패 시 1 유지 (사용자 흐름 방해 X)
            }
        }

        let recentPosts: { items: FreePost[]; total: number; totalPages: number; page: number } = {
            items: [],
            total: 0,
            totalPages: 1,
            page: recentPostsPage
        };

        // SEO 내부링크(#83): 작성자 최근 활동을 SSR 로 확정 — 활동 패널의 글/댓글
        // 앵커가 초기 HTML 에 포함되게 한다(별도 섹션 없이 기존 패널 재사용).
        // memberActivityPromise 는 댓글 fetch 와 병렬 + 2s 타임아웃 + 내부 catch 라
        // 페이지 로드를 추가로 블록하지 않는다. 익명·탈퇴는 상위 가드에서 null 수렴.
        const memberActivity = post.deleted_at ? null : await memberActivityPromise;

        // Phase 1C: 플러그인 enrich filter (member-memo author_memo 등).
        // 미설치 시 pass-through. (premium PR #43 기준 stub)
        // Step A′: 서버 hook 표준 컨텍스트(site/user) 전달.
        const enrichedPostList = (await applyFilter(
            'post.list.enrich',
            [post],
            buildHookContext(locals)
        )) as FreePost[];
        const enrichedPost = enrichedPostList[0] ?? post;

        return {
            boardId,
            post: enrichedPost,
            board: toDetailBoardPayload(board),
            commentsData,
            isScrapped: false,
            isRestricted: isRestrictedUser(locals.user as AuthUser | null),
            promotionExpired,
            watermark,
            disciplineViewer,
            truthroomPostId,
            originalPostLink,
            recentPosts,
            /** SEO 내부링크(#83): 작성자 활동 패널 SSR 확정 데이터 */
            memberActivity,
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

import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { Board, FreePost } from '$lib/api/types.js';
import { fetchPromotionPosts, fetchPromotionBoardPosts } from '$lib/server/ads/promotion.js';
import { getPageIndex } from '$lib/server/page-index';
import {
    applyAffiliateField,
    fetchPostAffiliateLinks,
    findAffiliateFieldRow,
    renderAffiliateContent,
    syncPostAffiliateLinks
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
import { fetchPostReportCount } from '$lib/server/report-count.js';
import { isSanctionedPost } from '$lib/server/sanctioned-lock.js';
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
import { resolveAngttMatch, type AngttMatch } from '$lib/server/angtt-dictionary.js';
import { getAngmapPlace, type AngmapPlaceCoord } from '$lib/server/angmap-place.js';
import { getPostAspects, type AspectRating } from '$lib/server/rating-aspects.js';
import { getBoardAspectPreset } from '$plugins/angtt-review/lib/aspect-presets';
import { fetchAngmapArchiveRating } from '$lib/server/angmap-archive-rating.js';
import { getBoardOwnerContext } from '$lib/server/board-owner';
import { resolveClientIp } from '$lib/server/rate-limit.js';

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
    request,
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
    // SSR 이 한 번에 싣는 댓글 수.
    //
    // ⛔ 10 이었을 때는 댓글 11개부터 클라이언트가 **전량을 다시** 받아왔다(backfill).
    //    2026-08-18 실측(최근 30일 34,302글): 평균 8.1개지만 24.8% 의 글이 10개를 넘어
    //    네 글 중 하나꼴로 왕복이 두 번 일어났고, 그 두 번째 요청은 캐시버스터(_t=)를 붙여
    //    캐시를 전혀 쓰지 못했다(파드 로그 실측: 댓글 요청 501건 중 275건이 캐시버스터).
    //
    // ⭐ 50 이면 **99.1% 의 글이 왕복 1회로 끝난다.**
    //      10개 이하 75.2% · 20개 91.0% · 30개 96.3% · 50개 99.1% · 100개 99.9% (최대 186)
    //    50개 응답도 압축 5KB 남짓이다(171개 전체가 15.2KB). 이미지 한 장보다 작다.
    //    partial 상태·backfill 재시도·앵커 스크롤 재시도가 대부분의 글에서 아예 발생하지 않는다.
    //
    // ⛔ backfill 경로를 지우지 마라. 50개를 넘는 0.9% 의 글은 여전히 그 경로로 채운다.
    const initialCommentsLimit = 50;
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
            // 자진삭제(작성자 본인 삭제, deleted_by == 작성자)면 본문만 가리고 그 아래
            // 댓글 스레드는 유지한다(#12965 — 댓글은 각 댓글 작성자의 소유·책임).
            // 타인 삭제(관리자/징계 등) 또는 삭제자 미상이면 댓글도 가린다(#12711).
            // 삭제 사유(자진/징계)는 문구로 구분하지 않는다. 댓글 API 게이트와 정합.
            // #13174: 신 백엔드는 삭제글에서 deleted_by/author_id 를 서버 drop 하고
            // 판정 결과인 self_deleted 만 내려준다. 구 백엔드 호환으로 기존 식을 폴백 유지.
            const selfDeleted =
                post.self_deleted ?? (!!post.deleted_by && post.deleted_by === post.author_id);
            if (!selfDeleted) {
                // 헤더 카운트 라벨/SSR total/클라 backfill 게이트 일치를 위해 권위 카운트 0.
                post.comments_count = 0;
            }
            setHeaders({ 'X-Robots-Tag': 'noindex, noarchive' });
        }

        // 신고잠금·이용제한 게이트 글 (비삭제) — be(#693)가 익명에게 content=''·is_restricted=true,
        // 이용제한 근거글은 title='[이용제한 근거 글]' 로 내려준다. 게이트 판정은 그 두 신호로만 한다
        // (허위 낙인 방지: 조회 실패 시 be 는 is_restricted 를 세우지 않으므로 여기서도 게이트로 보지 않음).
        // ⛔ deleted 는 위에서 이미 처리·return 없이 이어지므로 !post.deleted_at 로 배타 처리한다.
        const isGatedPost =
            !post.deleted_at &&
            (post.is_restricted === true || post.title?.trim() === '[이용제한 근거 글]');
        if (isGatedPost) {
            // (3) SEO — free 한정 색인 차단(§6 ①안). 게이트 글은 색인돼도 비로그인이 못 보므로
            //     noindex + noarchive 로 검색 노출을 막는다. 다른 보드는 기존 정책 유지(free 만).
            if (boardId === 'free') {
                setHeaders({ 'X-Robots-Tag': 'noindex, noarchive' });
            }
            // (4) private 2차 자물쇠 — 로그인 사용자에겐 be 가 실본문을 내려주므로, 그 응답이
            //     공유/엣지 캐시에 얹히지 않게 한다. CF 는 인증쿠키로 이미 익명과 분리하지만,
            //     오리진이 다른 쿠키집합을 봐 우연히 캐시되는 것을 막는 두 번째 자물쇠다.
            //     익명(마스킹) 응답은 캐시 가능하게 그대로 둔다.
            if (locals.user) {
                setHeaders({ 'Cache-Control': 'private, no-store' });
            }
        }

        // 앙지도 레거시 평점(아카이브): gnuboard 10점 시절 동결 집계를 읽기전용으로 별도 표시.
        // 신규 5점(post.rating)과 합치지 않는다 — 개인식별 매핑이 없어 합치면 날조가 된다.
        // 조회 실패는 헬퍼가 undefined 로 흡수 → 페이지 렌더에 영향 0.
        if (boardId === 'angmap' && !post.deleted_at) {
            post.archiveRating = await fetchAngmapArchiveRating(Number(postId));
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
            if (filesData.links?.length) {
                post.linkHits = filesData.links;
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

        // 앙티티 커넥트(Phase 1): 태그 「앙티티」 옵트인 글에만 작품 사전 매칭 + 별점 조회.
        // 사전=인메모리 5분 캐시(+실패 시 stale/빈 Map), fetch 는 2s 타임아웃 + 내부 catch —
        // 실패는 undefined 수렴이라 페이지 로드를 절대 블록하지 않는다.
        // 앙티티 게시판 자기 글에는 미표시. return 직전 await → SSR 렌더 (내부링크 SEO).
        const angttMatchPromise: Promise<AngttMatch | undefined> =
            boardId === 'angtt' || post.deleted_at
                ? Promise.resolve(undefined)
                : resolveAngttMatch(post.tags, { boardId, wrId: post.id }).catch(() => undefined);

        // 게시글 신고 잠금 상태(wr_7='lock') — 단일 조회를 outer scope 에서 미리 시작해
        // (1) 워터마크 대상 판정(동기 SSR 필요, 아래 line 731) 과
        // (2) 스트리밍 auxiliaryData 의 postReportCount (클라이언트 소비용, 아래 line 596)
        // 두 곳에서 같은 promise 를 공유한다 — DB 중복 조회 없이 동기 lock 신호를 확보.
        // bug/13548 후속: 백엔드 상세 응답에 extra_7(wr_7) 필드가 없어 post.extra_7 이 항상
        // undefined → 워터마크가 신고잠금 글에 안 뜨던 문제. 확실한 lock 신호를 이 값으로 대체.
        const postReportCountPromise: Promise<'lock' | null> = fetchPostReportCount(
            boardId,
            Number(postId)
        )
            .then((c) => (c === 'lock' ? ('lock' as const) : null))
            .catch(() => null);

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
            let clientIp = resolveClientIp(getClientAddress, request) ?? '';
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
                {
                    signal: AbortSignal.timeout(2_500),
                    // ⛔ Referer 를 붙여야 이 호출이 **내부 요청**으로 분류된다.
                    //    event.fetch 는 쿠키·인증 헤더만 승계할 뿐 Referer·x-real-ip 를 넘기지 않아,
                    //    붙이지 않으면 외부 요청으로 오분류돼 IP 속도제한 경로를 탄다.
                    //    (그 경로가 x-real-ip 부재로 500 을 냈다 — 2026-08-19 사고)
                    headers: { referer: `${url.origin}/${boardId}/${postId}` }
                }
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

            // 제휴 링크 lazy-convert-on-view (배포에 견디는 트리거).
            // 근본 원인: 지속형 자동 트리거가 배포 시스템 밖(go-service watcher)에 살아
            // 매 배포마다 죽어, 신규글이 변환되지 않고 매출이 끊겼다(2026-08-08 이후 $0).
            // 변환된 행이 0개(= 아직 미변환)이고 본문/링크에 외부 링크가 있을 때만
            // syncPostAffiliateLinks 를 fire-and-forget 로 호출한다. 트리거가 web 이미지
            // 안에 살아 배포에 견디며, 다음 조회부터 변환 링크가 노출된다.
            // 값싼 게이트로 링크 없는 글은 걸러 과발화를 막고, 행이 생기면 다시 발화하지 않는다.
            if (
                affiliateEnabled &&
                postAffiliateRows.length === 0 &&
                (Boolean(post.link1) ||
                    Boolean(post.link2) ||
                    (typeof post.content === 'string' && post.content.includes('http')))
            ) {
                try {
                    // await 금지 — SSR 렌더/응답을 절대 블로킹·지연하지 않는다. 에러는 삼킨다.
                    void syncPostAffiliateLinks(boardId, Number(postId)).catch(() => {});
                } catch {
                    // 트리거 실패해도 페이지는 오늘과 동일하게 렌더된다.
                }
            }

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
                // 게시글 신고 잠금 상태 (bug/13487)
                // 신고 17명 누적 시 백엔드가 wr_7='lock' 으로 자동 잠그는데, 그 상태가 상세 화면에
                // 배선돼 있지 않아(기존 하드코딩 null) isLockedPost 가 항상 false → 이미 잠긴 글에도
                // 신고 버튼이 살아 있어 "이미 신고 처리가 완료된 게시물입니다" 409 가 뜨던 문제.
                // lock 이면 비관리자에도 'lock' 을 내려 버튼 숨김+신고잠금 배지를 켠다.
                // 숫자 신고 횟수는 기존대로 노출하지 않는다(관리 기능은 /admin).
                // outer scope 에서 미리 시작한 공유 promise 재사용(워터마크 판정과 동일 조회).
                postReportCountPromise,
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

        // 워터마크 대상: 열람자 정보 전달
        // bug/13548: 진실의방 외에도 신고잠금(report-lock) "글"을 [보기]로 열람할 때 캡처방지
        // (Watermark 전체화면 오버레이)를 진실의방과 동일하게 적용한다. 기존엔 truthroom 만 채워
        // 일반 보드(free 등)의 신고잠금 글은 ContentBlur 로 열려도 캡처방지가 없었다.
        // - 글 잠금 신호: post.extra_7 === 'lock' (= wr_7. fetchPostReportCount 와 동일 컬럼이라
        //   postReportCount === 'lock' 과 동치) 또는 postReportLock(신고 횟수 조회 결과).
        // ⛔ bug/13548 후속(사장님 지시): 댓글만 잠긴 경우(글은 정상)는 더 이상 전체 오버레이를
        //   켜지 않는다. 정상 인기글이 댓글 하나 때문에 통째로 덮이던 문제 → 잠긴 댓글만
        //   좁게 처리한다(comment-list.svelte 가 자체 오버레이로 방어). clientIp 는
        //   SSR(getClientAddress)에서만 확정된다.
        // 신고잠금(wr_7='lock') 동기 신호 — post.extra_7 은 백엔드 상세 응답에 없어 항상
        // undefined 이므로, 확실한 lock 신호인 신고 횟수 조회 결과를 워터마크 판정에 사용한다.
        const postReportLock = (await postReportCountPromise) === 'lock';

        // 신고잠금(wr_7='lock') 2형 구분 — 제재 확정(B형) 여부.
        //  A형: 신고 누적 자동잠금(미제재)
        //  B형: 관리자 제재 확정(g5_na_singo processed=1 AND admin_approved=1 AND discipline_log_id>0)
        //
        // ⛔ 2026-08-18: **더 이상 신고 버튼 게이트가 아니다.** 신고는 두 형 모두 받는다.
        // 종전 주석에 "백엔드가 409+DB 트리거로 재신고를 막는다"고 적혀 있었으나
        // 그 트리거는 애초에 존재하지 않았고, 409 도 제거했다(angple-backend).
        // 중복 처분은 동일인 중복 가드 · contentSanctioned(재잠금 금지) ·
        // ops inbox 의 processedExclusionSQL 이 나눠 막는다.
        //
        // 값은 계속 내려보낸다 — 레이아웃·테마가 같은 ViewLayoutProps 를 쓰고,
        // 앞으로 다른 표시(배지 등)에 쓸 수 있다. 잠긴 글에서만 조회하므로 비용은 제한적이다.
        // isSanctionedPost 는 내부 try/catch 로 실패 시 false 수렴한다.
        const isSanctioned =
            postReportLock || post.extra_7 === 'lock'
                ? await isSanctionedPost(boardId, Number(postId))
                : false;

        let watermark: { nickname: string; userId: string; clientIp: string } | null = null;
        // ⛔ locals.user 가드 필수 — 익명 SSR 응답은 CDN 캐시라 워터마크에 요청자 IP 가
        //    박히면 첫 익명 방문자 IP 가 이후 모두에게 노출된다(#12920, 아래 disciplineViewer 와 동일 이유).
        if ((boardId === 'truthroom' || post.extra_7 === 'lock' || postReportLock) && locals.user) {
            let clientIp = resolveClientIp(getClientAddress, request) ?? '';
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
            let clientIp = resolveClientIp(getClientAddress, request) ?? '';
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
            // ⛔ 예전에는 여기서 `/api/.../page-index` 를 svelteKitFetch 로 불렀다.
            //    같은 프로세스인데 Request/Response 생성과 JSON 왕복이 매 요청 일어나서,
            //    캐시 적중인데도 1~3ms 가 걸렸다(Redis GET 하나면 1ms 미만이어야 한다).
            //    실측상 이 계산의 호출자는 100% SSR 이라(브라우저 요청 0건) HTTP 계층이 순수 낭비였다.
            // → 같은 로직을 함수로 직접 부른다. 결과·캐시 키·TTL 은 완전히 동일하다.
            //    getPageIndex 는 던지지 않고 실패 시 page:1 을 돌려주므로 try 가 필요 없다.
            const pi = await getPageIndex(boardId, Number(postId));
            if (pi.page > 1) {
                recentPostsPage = pi.page;
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

        // 앙티티 커넥트 카드 데이터 — 위에서 병렬 시작한 promise 를 여기서 확정 (reject 없음).
        const angttMatch = await angttMatchPromise;

        // 앙지도(angmap) 상세 미니맵용 좌표 — angmap 보드 + 미삭제 글에서만 조회(읽기 전용).
        // 좌표 없으면 null → 상세에서 지도 미표시(빈 박스 금지). 실패는 내부 catch → null.
        const angmapPlace: AngmapPlaceCoord | null =
            boardId === 'angmap' && !post.deleted_at ? await getAngmapPlace(post.id) : null;

        // 항목별 평점 집계(옵트인 표시·입력용) — 프리셋이 매핑된 보드(angmap) + features.rating
        // (post.rating 동봉) 글에서만 조회. 총점 위젯이 이 값으로 항목별 UI 를 렌더한다.
        // 실패는 빈 배열로 수렴(부가 기능 — 상세 로드 무영향).
        const postAspects: AspectRating[] =
            !post.deleted_at && post.rating && getBoardAspectPreset(boardId)
                ? await getPostAspects(boardId, post.id, locals.user?.id).catch(() => [])
                : [];

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
            /**
             * 신고잠금 글이 관리자 제재 확정(B형)인지. true 면 신고 버튼을 계속 숨긴다.
             * A형(신고 누적 자동잠금)은 false → 추가 신고 버튼을 다시 노출. isLockedPost(가림/배지)와 독립.
             */
            isSanctioned,
            truthroomPostId,
            originalPostLink,
            recentPosts,
            /** SEO 내부링크(#83): 작성자 활동 패널 SSR 확정 데이터 */
            memberActivity,
            /** 앙티티 커넥트(Phase 1): 태그 「앙티티」+작품명 → 작품 카드 (없으면 undefined) */
            angttMatch,
            /** 앙지도(angmap) 상세 미니맵 좌표 — angmap 보드 + 좌표 확보 글에서만 (없으면 null) */
            angmapPlace,
            /** 항목별 평점 집계(옵트인 표시·입력용) — 프리셋 매핑 보드에서만 채워짐(그 외 빈 배열) */
            postAspects,
            /**
             * 이 소모임의 당주인지 (공지 고정 버튼 노출용).
             * ⛔ 이건 화면 표시용 힌트일 뿐이고, 실제 권한은 공지 API 가 다시 검증한다.
             *    소모임이 아니거나 당주가 아니면 false.
             */
            canManageBoard: !!(await getBoardOwnerContext(
                boardId,
                // locals.user 는 { id, level } 형태다 — 판정 함수가 쓰는 이름으로 옮긴다.
                locals.user?.id ? { mb_id: locals.user.id, mb_level: locals.user.level ?? 0 } : null
            ).catch(() => null)),
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

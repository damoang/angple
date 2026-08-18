/**
 * 댓글 목록 API (레거시 g5_write_{boardId} 기반)
 *
 * GET /api/boards/[boardId]/posts/[postId]/comments?page=1&limit=10
 *
 * wr_comment + wr_comment_reply 순서로 정렬하여 올바른 스레드 순서 보장
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getDisciplineIds } from '$lib/server/discipline-ids';
import { isValidBoardId } from '$lib/utils/board-id.js';
import {
    applyAffiliateField,
    fetchCommentAffiliateLinks,
    findAffiliateFieldRow,
    groupAffiliateLinksByCommentId,
    renderAffiliateContent
} from '$lib/server/affiliate-links';
import { isLinkProcessingPluginEnabled } from '$lib/server/link-processing/runtime';
import { isInternalAppRequest } from '$lib/server/internal-api.js';
import { checkRateLimit, recordAttempt, resolveClientIp } from '$lib/server/rate-limit.js';
import { fetchWithdrawnMemberIds } from '$lib/server/withdrawn-members.js';
import { prefetchBlueskyDIDs } from '$lib/server/bluesky/transform.js';

interface CommentRow extends RowDataPacket {
    wr_id: number;
    wr_parent: number;
    wr_comment: number;
    wr_comment_reply: string;
    wr_content: string;
    wr_link1: string;
    wr_link2: string;
    wr_option: string;
    wr_good: number;
    wr_nogood: number;
    mb_id: string;
    wr_name: string;
    wr_ip: string;
    wr_datetime: string;
    wr_edit_count: number;
    wr_last_edited_at: string | null;
    wr_deleted_at: string | null;
    wr_deleted_by: string | null;
    wr_7: string | null;
    /** 소모임 전역 공지의 댓글이 어느 소모임에서 작성됐는지 (백엔드가 검증해 저장). */
    wr_1: string | null;
}

interface CountRow extends RowDataPacket {
    total: number;
}

interface CommentResponseItem {
    id: number;
    content: string;
    link1: string;
    link2: string;
    author: string;
    author_id: string;
    author_image: string;
    author_image_updated_at?: number;
    author_ip: string;
    likes: number;
    dislikes: number;
    depth: number;
    parent_id: number;
    created_at: string;
    updated_at?: string;
    is_secret: boolean;
    deleted_at: string | null;
    deleted_by: string | null;
    edit_count: number;
    link1_display?: string;
    link2_display?: string;
    link1_affiliate?: boolean;
    link2_affiliate?: boolean;
    report_count?: string | number;
    is_discipline_related?: boolean;
    /** 요청자가 이 댓글 작성자를 차단했는지(서버 판정). 클라 스토어 로드 전 깜박임 방지용(#12825). */
    is_blocked?: boolean;
    /** 작성자가 탈퇴 회원인지 — 닉네임 취소선 표시용. */
    is_left?: boolean;
    /** 소모임 전역 공지 댓글의 유입 소모임 slug. */
    from_board?: string;
    /** 위 소모임의 표시 이름 (bo_subject). */
    from_board_name?: string;
    /** 리뷰 별점(리뷰=댓글+별점): 작성자가 이 댓글에 남긴 리뷰 점수(1~5). 별점 게시판만. */
    review_rating?: number;
}

function maskIp(ip: string): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.♡.${parts[2]}.${parts[3]}`;
    }
    return ip;
}

// 한 번에 가져올 수 있는 댓글 수. **요청자와 무관하게 동일하다.**
//
// ⛔ 예전에는 외부 요청을 20건·1페이지로 잘랐다(EXTERNAL_COMMENT_LIMIT=20,
//    MAX_EXTERNAL_COMMENT_PAGE=1). 2026-08-18 제보(free/7058811 "댓글이 다 표출이 안 된다")로
//    걷어냈다. 그 절단은 두 가지로 잘못돼 있었다.
//
//  ① **이미 무력했다.** nginx 가 이 경로를 `proxy_cache_key "$request_uri"` 로만 캐시해서
//     응답 종류를 구분하지 못했다. 브라우저가 채운 전체 목록을 봇이 그대로 받아가는 것을 실측했다
//     (98건 글에서 봇이 98건 수령). 자르고 있던 대상은 **정상 사용자뿐**이었다.
//  ② **정상 사용자를 오분류했다.** 판정(isInternalAppRequest)은 Referer·Sec-Fetch-Site 같은
//     헤더에 의존하는데, 그 헤더가 제거되는 환경(프라이버시 확장, 헤더를 지우는 프록시 등)에서는
//     **새로고침해도 영원히 20건**만 보였다.
//
// ⭐ 같은 저장소가 글 목록에서 이미 같은 결론에 도달했다(#826 → #12571):
//    "첫페이지 하드캡은 콘텐츠를 보호하지 못하면서 RecentPosts 만 깨뜨렸다.
//     하드캡 대신 rate-limit 으로 정상 페이지네이션은 허용하고 대량 스크래핑만 억제한다."
//    댓글만 전환이 안 된 채 남아 있었다. 여기서 맞춘다.
//
// ⛔ 다시 절단으로 되돌리지 마라. 댓글은 로그인 없이 웹에서 보이는 공개 데이터이고
//    SSR HTML 에도 실린다. JSON 절단은 스크래퍼를 못 막고 사용자만 깨뜨린다.
const COMMENT_LIMIT = 200;

// 외부 요청 rate-limit — 글 목록(EXTERNAL_POSTS_RATE_LIMIT)과 같은 기준.
// ⚠️ checkRateLimit 은 파드 in-memory 라 실효 한도는 (이 값 × 파드 수) 다.
const EXTERNAL_COMMENTS_RATE_LIMIT = 60; // 분당 60회
const EXTERNAL_COMMENTS_RATE_WINDOW_MS = 60_000;

export const GET: RequestHandler = async ({ params, url, locals, request, getClientAddress }) => {
    const { boardId, postId } = params;
    const isAdmin = (locals.user?.level ?? 0) >= 10;
    // 비로그인에게는 마스킹된 IP 조차 내리지 않는다 — `120.♡.35.175` 는 4옥텟 중
    // 3개가 그대로라 /24 대역이 식별된다. 좋아요 목록 API(likers)가 이미 쓰는
    // 정책(비로그인=빈 값)과 통일한다. 키는 유지하고 값만 비운다(#604).
    const isMember = Boolean(locals.user);
    const isInternalRequest = isInternalAppRequest(request);

    // `!boardId` 만으로는 부족하다 — 클라이언트가 URL 을 템플릿 리터럴로 만들면 값이 없을 때
    // 문자열 `"undefined"` 가 경로에 박히고, 그대로 `g5_write_undefined` 를 조회하다 실패한다.
    // 존재하지 않을 게 확실한 이름은 DB 까지 가기 전에 400 으로 끊는다.
    if (!isValidBoardId(boardId) || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(postId, 10);

    if (isNaN(safePostId)) {
        return json({ success: false, message: '유효하지 않은 postId입니다.' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const requestedLimit = Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10));
    const limit = Math.min(requestedLimit, COMMENT_LIMIT);

    // 외부 요청은 자르지 않고 rate-limit 으로 억제한다(위 주석 참조).
    if (!isInternalRequest) {
        // ⛔ getClientAddress() 를 직접 부르면 안 된다 — x-real-ip 가 없으면 throw 하고
        //    그대로 500 이 된다. SSR 이 event.fetch 로 이 API 를 부를 때가 정확히 그 경우다.
        //    IP 를 못 구하면 제한을 **건너뛴다**(키 없이는 못 거는 게 정상이다).
        const ip = resolveClientIp(getClientAddress, request);
        if (ip) {
            const rl = checkRateLimit(
                ip,
                'board-comments',
                EXTERNAL_COMMENTS_RATE_LIMIT,
                EXTERNAL_COMMENTS_RATE_WINDOW_MS
            );
            if (!rl.allowed) {
                return json(
                    { success: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
                    {
                        status: 429,
                        headers: rl.retryAfter ? { 'Retry-After': String(rl.retryAfter) } : {}
                    }
                );
            }
            recordAttempt(ip, 'board-comments');
        }
    }

    const effectivePage = page;

    const tableName = `g5_write_${safeBoardId}`;

    try {
        // 부모 글 조회 — 삭제 여부(#12711) + 마음메시지 익명 판정에 사용.
        // 익명 마음메시지는 PublishToGnuboard() 에서 wr_name="" 로 저장된다.
        const [parentRows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_deleted_at, wr_deleted_by, mb_id, wr_name FROM ?? WHERE wr_id = ? AND wr_is_comment = 0 LIMIT 1`,
            [tableName, safePostId]
        );
        const parent = parentRows[0];

        // 마음메시지(message) 익명 글: 신청자(원글 작성자)의 신원이 댓글에서 노출되지
        // 않도록, 원글 작성자 본인이 단 댓글은 아바타/프로필/닉을 '익명'으로 가린다.
        // (표시 마스킹만 수행 — 댓글 알림은 write 시점 백엔드에서 실제 mb_id 로 발송되므로 영향 없음)
        const postIsAnonymousMessage =
            safeBoardId === 'message' &&
            !!parent &&
            (parent.wr_name ?? '').toString().trim() === '';
        const anonymousAuthorId = postIsAnonymousMessage ? String(parent.mb_id ?? '') : '';

        // 비밀댓글 열람 권한 (서버 판정).
        // ⛔ 이전에는 wr_content 를 그대로 내려보내고 화면에서만 가렸다. 즉 비로그인이
        //    API 를 직접 호출하면 비밀댓글 본문이 평문으로 읽혔다(2026-07-21 실측 확인,
        //    free 177건·economy 2건). 쓴 사람은 비밀이라고 믿고 쓴 내용이다.
        //    클라이언트 마스킹은 표시 편의일 뿐 접근 통제가 될 수 없으므로 서버에서 가린다.
        // 열람 가능: 댓글 작성자 · 원글 작성자 · 관리자(레벨 10+)
        //   — comment-list.svelte 의 canViewSecretComment 와 같은 기준.
        const secretViewerId = locals.user?.id ? String(locals.user.id) : '';
        const postAuthorId = String(parent?.mb_id ?? '');
        const viewerIsPostAuthor = !!secretViewerId && secretViewerId === postAuthorId;
        const canViewSecret = (commentAuthorId: string): boolean => {
            if (isAdmin) return true;
            if (!secretViewerId) return false;
            if (secretViewerId === commentAuthorId) return true;
            return viewerIsPostAuthor;
        };

        // 부모 글 삭제 여부 확인.
        // - 자진삭제(작성자 본인이 삭제, wr_deleted_by == 원글 mb_id): 댓글은 각 댓글
        //   작성자의 것이므로 그 아래 댓글 스레드를 계속 노출한다(#12965).
        // - 타인 삭제(관리자/징계 등, wr_deleted_by != 원글 mb_id) 또는 삭제자 미상:
        //   콘텐츠 정책상 댓글도 가린다. 삭제 사유(징계 여부)는 노출하지 않는다.
        // 관리자는 조정 목적상 항상 열람 가능.
        const parentSelfDeleted =
            !!parent?.wr_deleted_at &&
            !!parent?.wr_deleted_by &&
            String(parent.wr_deleted_by) === String(parent.mb_id);
        if (!isAdmin) {
            if (!parent || (parent.wr_deleted_at && !parentSelfDeleted)) {
                return json(
                    {
                        success: true,
                        data: {
                            comments: [],
                            total: 0,
                            page: effectivePage,
                            limit,
                            total_pages: 0
                        }
                    },
                    { headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' } }
                );
            }
        }

        // 전체 댓글 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM ?? WHERE wr_parent = ? AND wr_is_comment = 1`,
            [tableName, safePostId]
        );
        const total = countRows[0]?.total ?? 0;
        const totalPages = Math.ceil(total / limit);

        // 댓글 조회 (wr_comment + wr_comment_reply 순으로 정렬 — Go 백엔드와 동일)
        // 삭제된 댓글도 포함하여 조회 (프론트엔드에서 "삭제된 댓글입니다" 표시용)
        const [rows] = await pool.query<CommentRow[]>(
            `SELECT wr_id, wr_parent, wr_comment, wr_comment_reply, wr_content, wr_link1, wr_link2, wr_option,
			        wr_good, wr_nogood, mb_id, wr_name, wr_ip, wr_datetime,
			        wr_edit_count, wr_last_edited_at,
			        wr_deleted_at, wr_deleted_by, wr_7, wr_1
			 FROM ??
			 WHERE wr_parent = ? AND wr_is_comment = 1
			 ORDER BY wr_comment, wr_comment_reply, wr_id
			 LIMIT ? OFFSET ?`,
            [tableName, safePostId, limit, (effectivePage - 1) * limit]
        );

        // 닉네임 조회 (mb_id → mb_nick)
        const mbIds = [...new Set(rows.map((r) => r.mb_id).filter(Boolean))];
        const nickMap = new Map<string, string>();
        const imageMap = new Map<string, string>();
        const imageUpdatedMap = new Map<string, number>();
        if (mbIds.length > 0) {
            const [members] = await pool.query<RowDataPacket[]>(
                `SELECT mb_id, mb_nick, mb_image_url, mb_image_updated_at FROM g5_member WHERE mb_id IN (?)`,
                [mbIds]
            );
            for (const m of members) {
                nickMap.set(m.mb_id, m.mb_nick);
                if (m.mb_image_url) imageMap.set(m.mb_id, m.mb_image_url);
                if (m.mb_image_updated_at)
                    imageUpdatedMap.set(
                        m.mb_id,
                        Math.floor(new Date(m.mb_image_updated_at).getTime() / 1000)
                    );
            }
        }

        // 댓글 수정 횟수/최근 수정 시각은 비정규화 컬럼(wr_edit_count·wr_last_edited_at)에서
        // 직접 읽는다 — 매 조회 g5_write_revisions COUNT 제거(읽기 쿼리 0). 게시글 상세와 동일 정책.
        const commentIds = rows.map((r) => r.wr_id);

        // 이용제한 근거 댓글 식별 (g5_na_singo.discipline_log_id IS NOT NULL)
        //
        // ⛔ 예전에는 여기서 댓글 ID 목록을 넣어 **요청마다** DB 를 쳤다.
        //    2026-08-18 실측: 2억 544만회 · 156,047초 = DB 실행시간의 5.0%.
        //    한 번이 느린 게 아니라(EXPLAIN rows:5) 부르는 횟수가 문제였고,
        //    반환은 평균 0.0행 — 거의 언제나 빈손이었다.
        // → 게시판 단위 집합을 캐시하고 메모리에서 판정한다(전 게시판 합쳐 3,407개·54KB).
        const boardDisciplineIds = await getDisciplineIds(safeBoardId);
        const disciplineSet = new Set<number>();
        for (const id of commentIds) {
            if (boardDisciplineIds.has(id)) disciplineSet.add(id);
        }

        // 리뷰 별점(리뷰=댓글+별점): angple_post_ratings 에서 댓글 wr_id 별 평균(작성자 리뷰 점수).
        // 초경량 테이블 + PK(bo_table,wr_id) 인덱스 seek. 비rating 보드는 결과 0(무해). 실패 무시.
        const reviewRatingMap = new Map<number, number>();
        if (commentIds.length > 0) {
            try {
                const [rrRows] = await pool.query<RowDataPacket[]>(
                    `SELECT wr_id, ROUND(AVG(rating), 1) AS avg_rating
                     FROM angple_post_ratings
                     WHERE bo_table = ? AND wr_id IN (?)
                     GROUP BY wr_id`,
                    [safeBoardId, commentIds]
                );
                for (const r of rrRows) reviewRatingMap.set(Number(r.wr_id), Number(r.avg_rating));
            } catch (e) {
                console.warn('[review-rating] enrich(comments) failed:', e);
            }
        }

        // 요청자가 차단한 작성자 집합 (#12825). 서버에서 is_blocked 를 판정해 내려주면
        // 클라이언트 차단 스토어가 비동기 로드되기 전에도 첫 렌더부터 접힘 상태로 표시되어
        // "보였다 숨었다" 깜박임이 사라진다. 실패는 무시(클라 스토어가 fallback).
        // "쪽지만 차단"(block_scope='message')은 콘텐츠 숨김 대상이 아니다 (#12916, #12934).
        const blockedSet = new Set<string>();
        const viewerId = locals.user?.id;
        if (viewerId) {
            try {
                const [bRows] = await pool.query<RowDataPacket[]>(
                    `SELECT blocked_mb_id FROM g5_member_block WHERE mb_id = ? AND block_scope <> 'message'`,
                    [viewerId]
                );
                for (const b of bRows) {
                    if (b.blocked_mb_id) blockedSet.add(String(b.blocked_mb_id));
                }
            } catch (e) {
                console.warn('[block] enrich(comments) failed:', e);
            }
        }

        // 탈퇴 회원 작성자 집합 — 닉네임 취소선 표시용(배치 조회, 5분 캐시).
        const authorIds = Array.from(new Set(rows.map((r) => String(r.mb_id)).filter(Boolean)));
        const withdrawnSet = await fetchWithdrawnMemberIds(authorIds).catch(
            () => new Set<string>()
        );

        // 유입 소모임 이름 — 소모임 전역 공지(원본 1건을 91개 소모임이 공유)의 댓글에만 붙는다.
        // wr_1 에 이미 없어진 게시판 slug 가 남아 있을 수 있어 현재 소모임만 인정한다.
        const fromSlugs = Array.from(
            new Set(rows.map((r) => (r.wr_1 || '').trim()).filter(Boolean))
        );
        const fromBoardNameMap = new Map<string, string>();
        if (fromSlugs.length > 0) {
            try {
                const [boardRows] = await pool.query<RowDataPacket[]>(
                    `SELECT bo_table, bo_subject FROM g5_board WHERE bo_table IN (?) AND gr_id = 'group'`,
                    [fromSlugs]
                );
                for (const b of boardRows) {
                    fromBoardNameMap.set(String(b.bo_table), String(b.bo_subject));
                }
            } catch (e) {
                // 표기용 부가 정보라 실패해도 댓글 목록은 그대로 내려보낸다.
                console.warn('[comments] from_board enrich failed:', e);
            }
        }

        const comments: CommentResponseItem[] = rows.map((row) => {
            // 비밀댓글은 열람 권한이 없으면 본문·링크를 서버에서 비운다.
            // is_secret 플래그는 그대로 내려 화면이 "비밀댓글입니다" 안내를 유지한다.
            const rowIsSecret = row.wr_option?.includes('secret') || false;
            const secretHidden = rowIsSecret && !canViewSecret(String(row.mb_id ?? ''));

            return {
                id: row.wr_id,
                content: secretHidden
                    ? ''
                    : row.wr_deleted_at
                      ? isAdmin
                          ? row.wr_content
                          : ''
                      : row.wr_content,
                link1: secretHidden
                    ? ''
                    : row.wr_deleted_at
                      ? isAdmin
                          ? row.wr_link1 || ''
                          : ''
                      : row.wr_link1 || '',
                link2: secretHidden
                    ? ''
                    : row.wr_deleted_at
                      ? isAdmin
                          ? row.wr_link2 || ''
                          : ''
                      : row.wr_link2 || '',
                author: row.wr_deleted_at
                    ? isAdmin
                        ? nickMap.get(row.mb_id) || row.wr_name || row.mb_id
                        : ''
                    : nickMap.get(row.mb_id) || row.wr_name || row.mb_id,
                author_id: row.wr_deleted_at ? (isAdmin ? row.mb_id : '') : row.mb_id,
                author_image: row.wr_deleted_at
                    ? isAdmin
                        ? imageMap.get(row.mb_id) || ''
                        : ''
                    : imageMap.get(row.mb_id) || '',
                author_image_updated_at: row.wr_deleted_at
                    ? isAdmin
                        ? imageUpdatedMap.get(row.mb_id)
                        : undefined
                    : imageUpdatedMap.get(row.mb_id),
                author_ip: row.wr_deleted_at
                    ? isAdmin
                        ? row.wr_ip
                        : ''
                    : isAdmin
                      ? row.wr_ip
                      : isMember
                        ? maskIp(row.wr_ip)
                        : '',
                likes: row.wr_good,
                dislikes: row.wr_nogood,
                depth: row.wr_comment_reply.length,
                parent_id: row.wr_parent,
                created_at: row.wr_datetime,
                updated_at: row.wr_last_edited_at || undefined,
                is_secret: row.wr_option?.includes('secret') || false,
                deleted_at: row.wr_deleted_at || null,
                deleted_by: row.wr_deleted_by || null,
                edit_count: row.wr_edit_count || 0,
                ...(row.mb_id && blockedSet.has(String(row.mb_id)) ? { is_blocked: true } : {}),
                ...(row.mb_id && withdrawnSet.has(String(row.mb_id)) ? { is_left: true } : {}),
                ...(row.wr_1 && fromBoardNameMap.has(row.wr_1.trim())
                    ? {
                          from_board: row.wr_1.trim(),
                          from_board_name: fromBoardNameMap.get(row.wr_1.trim())
                      }
                    : {}),
                ...(disciplineSet.has(row.wr_id) ? { is_discipline_related: true } : {}),
                ...(reviewRatingMap.has(row.wr_id)
                    ? { review_rating: reviewRatingMap.get(row.wr_id) }
                    : {}),
                ...(isAdmin && row.wr_7
                    ? {
                          report_count:
                              row.wr_7 === 'lock' ? 'lock' : parseInt(row.wr_7, 10) || undefined
                      }
                    : {})
            };
        });

        // 마음메시지 익명: 원글 작성자(신청자) 본인의 댓글은 신원을 가린다.
        // author/author_id/author_image 를 비워 프로필·팔로우·쪽지 링크로 신원이 드러나지 않게 한다.
        if (postIsAnonymousMessage && anonymousAuthorId) {
            for (const c of comments) {
                if (c.author_id === anonymousAuthorId) {
                    c.author = '익명';
                    c.author_id = '';
                    c.author_image = '';
                    c.author_image_updated_at = undefined;
                }
            }
        }

        // Bluesky handle → DID prefetch (#12050).
        // 댓글 본문 내 `bsky.app/profile/<handle>/post/<id>` URL 의 handle 을 DID 로
        // 일괄 치환. content-transform (affiliate, embed) 단계 전에 수행한다.
        // Redis 30일 TTL 캐시로 동일 handle 재요청 부담 최소.
        // 실패 시 원본 본문 유지 → UX 악화 없음.
        try {
            const transformed = await Promise.all(
                comments.map((c) =>
                    typeof c.content === 'string' && c.content
                        ? prefetchBlueskyDIDs(c.content).catch(() => c.content)
                        : Promise.resolve(c.content)
                )
            );
            comments.forEach((c, i) => {
                c.content = transformed[i];
            });
        } catch (e) {
            console.warn('[bluesky] prefetchBlueskyDIDs(comments) failed:', e);
        }

        const affiliateEnabled = await isLinkProcessingPluginEnabled().catch(() => false);
        const commentAffiliateRows = affiliateEnabled
            ? await fetchCommentAffiliateLinks(
                  safeBoardId,
                  safePostId,
                  comments.map((comment) => Number(comment.id)).filter((id) => !isNaN(id) && id > 0)
              ).catch(() => [])
            : [];
        const affiliateRowsByCommentId = groupAffiliateLinksByCommentId(commentAffiliateRows);

        for (const comment of comments) {
            const rowsForComment = affiliateRowsByCommentId.get(Number(comment.id)) || [];

            if (affiliateEnabled && typeof comment.content === 'string' && comment.content) {
                comment.content = renderAffiliateContent(
                    comment.content,
                    rowsForComment,
                    'comment_body'
                );
            }

            if (affiliateEnabled && comment.link1) {
                const result = applyAffiliateField(
                    comment.link1,
                    findAffiliateFieldRow(rowsForComment, 'comment_link1')
                );
                if (result.href !== comment.link1) {
                    comment.link1_display = result.displayUrl;
                    comment.link1 = result.href;
                    comment.link1_affiliate = result.affiliate;
                }
            }

            if (affiliateEnabled && comment.link2) {
                const result = applyAffiliateField(
                    comment.link2,
                    findAffiliateFieldRow(rowsForComment, 'comment_link2')
                );
                if (result.href !== comment.link2) {
                    comment.link2_display = result.displayUrl;
                    comment.link2 = result.href;
                    comment.link2_affiliate = result.affiliate;
                }
            }
        }

        return json(
            {
                success: true,
                data: {
                    comments,
                    total,
                    page: effectivePage,
                    limit,
                    total_pages: totalPages
                },
                // 댓글 수정 정책 (단일 출처: env). 프론트 confirm 다이얼로그/차감 안내에서 사용.
                // 기본값은 backend 의 getCommentEditPolicy() 와 일치 (50000P / 300s).
                meta: {
                    comment_edit_policy: {
                        cost: Number(process.env.COMMENT_EDIT_COST ?? 50000),
                        grace_seconds: Number(process.env.COMMENT_EDIT_GRACE_SECONDS ?? 300)
                    }
                }
            },
            {
                // 로그인 사용자: 작성 후 refetch stale 차단(#12548) + 뷰어별 is_blocked 개인화 → private.
                // 비로그인: 개인화 없음(공개) + 댓글을 쓰지 않음 → 짧은 SWR 캐시로 SPA backfill
                //   스켈레톤을 near-instant 로 (신규 댓글은 최대 10초 지연). 리액션 GET 과 동일 패턴 —
                //   CloudFront 가 쿠키 기준으로 로그인/비로그인 캐시를 분리하므로 개인화 누출 없음.
                headers: {
                    'Cache-Control': locals.user?.id
                        ? 'private, no-cache, no-store, must-revalidate'
                        : 'public, s-maxage=10, stale-while-revalidate=30'
                }
            }
        );
    } catch (error) {
        console.error('Comments GET error:', error);
        return json({ success: false, message: '댓글 조회에 실패했습니다.' }, { status: 500 });
    }
};

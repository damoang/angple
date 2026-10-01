/**
 * 댓글 추천자 배치 조회 API
 * GET /api/boards/[boardId]/posts/[postId]/comments/likers-batch?commentIds=1,2,3&limit=5
 *
 * 여러 댓글의 추천자를 한 번에 조회 (N+1 방지)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit, recordAttempt, resolveClientIp } from '$lib/server/rate-limit.js';
import { getAuthUser } from '$lib/server/auth';
import { isInternalAppRequest } from '$lib/server/internal-api.js';
import {
    COMMENT_LIKERS_BATCH_IDS,
    COMMENT_LIKERS_BATCH_LIMIT,
    fetchCommentLikersBatch
} from '$lib/server/comment-likers.js';

// 외부 요청 rate-limit — 댓글·글 목록과 같은 기준.
// ⚠️ checkRateLimit 은 파드 in-memory 라 실효 한도는 (이 값 × 파드 수) 다.
const EXTERNAL_LIKERS_BATCH_RATE_LIMIT = 60; // 분당 60회
const EXTERNAL_LIKERS_BATCH_RATE_WINDOW_MS = 60_000;

export const GET: RequestHandler = async ({ params, url, cookies, request, getClientAddress }) => {
    const { boardId } = params;
    const isInternalRequest = isInternalAppRequest(request);
    const commentIdsParam = url.searchParams.get('commentIds');
    const requestedLimit = Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10));
    const limit = Math.min(requestedLimit, COMMENT_LIKERS_BATCH_LIMIT);

    // 외부 요청은 자르지 않고 rate-limit 으로 억제한다(위 주석 참조).
    if (!isInternalRequest) {
        // ⛔ getClientAddress() 를 직접 부르면 안 된다 — x-real-ip 가 없으면 throw 하고
        //    그대로 500 이 된다. SSR 이 event.fetch 로 이 API 를 부를 때가 정확히 그 경우다.
        //    IP 를 못 구하면 제한을 **건너뛴다**(키 없이는 못 거는 게 정상이다).
        const ip = resolveClientIp(getClientAddress, request);
        if (ip) {
            const rl = checkRateLimit(
                ip,
                'comment-likers-batch',
                EXTERNAL_LIKERS_BATCH_RATE_LIMIT,
                EXTERNAL_LIKERS_BATCH_RATE_WINDOW_MS
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
            recordAttempt(ip, 'comment-likers-batch');
        }
    }

    if (!boardId || !commentIdsParam) {
        return json(
            { success: false, message: 'boardId와 commentIds가 필요합니다.' },
            { status: 400 }
        );
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');

    // commentIds 파싱 및 검증
    const commentIds = commentIdsParam
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id))
        .slice(0, COMMENT_LIKERS_BATCH_IDS);

    if (commentIds.length === 0) {
        return json({ success: false, message: '유효한 commentIds가 없습니다.' }, { status: 400 });
    }

    try {
        const user = await getAuthUser(cookies);
        const data = await fetchCommentLikersBatch(safeBoardId, commentIds, limit, !!user);
        return json({ success: true, data });
    } catch (error) {
        console.error('Comment likers batch GET error:', error);
        return json(
            { success: false, message: '추천자 목록 배치 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

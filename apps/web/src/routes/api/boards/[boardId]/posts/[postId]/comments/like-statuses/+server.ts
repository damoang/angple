/**
 * 현재 사용자의 댓글 좋아요/비추천 상태 배치 조회 (클라이언트용) — bug/13729
 * GET /api/boards/[boardId]/posts/[postId]/comments/like-statuses
 *
 * 글상세는 SSR_STRIP_USER 로 SSR 시 user=null 이라(엣지캐시 설계) 서버 렌더에 실은
 * 하트 상태가 항상 비어 온다. 클라이언트가 인증 확립 후 이 라우트로 실제 상태를 다시 받아
 * 하트를 채운다. 인증은 요청 쿠키에서 직접 확립하므로(getAuthUser) 페이지 로드 strip 과 무관.
 * fetchCommentLikeStatuses 는 글 전체 댓글을 조회하므로 페이지네이션/backfill 과 절연된다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUser } from '$lib/server/auth';
import { fetchCommentLikeStatuses } from '$lib/server/comment-likes';

export const GET: RequestHandler = async ({ params, cookies }) => {
    const boardId = (params.boardId ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    const postId = Number(params.postId);
    if (!boardId || !Number.isFinite(postId) || postId <= 0) {
        return json({ success: false, data: { likedIds: [], dislikedIds: [] } }, { status: 400 });
    }

    const user = await getAuthUser(cookies);
    if (!user) {
        // 비로그인은 빈 상태(성공). 하트는 비워 둔다.
        return json({ success: true, data: { likedIds: [], dislikedIds: [] } });
    }

    try {
        const data = await fetchCommentLikeStatuses(boardId, postId, user.mb_id);
        return json({ success: true, data });
    } catch (err) {
        console.error('comment like-statuses 조회 실패:', err);
        return json({ success: false, data: { likedIds: [], dislikedIds: [] } }, { status: 500 });
    }
};

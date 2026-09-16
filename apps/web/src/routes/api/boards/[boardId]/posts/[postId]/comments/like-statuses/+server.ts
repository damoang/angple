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
        // ⛔ 없는 게시판(`g5_write_<id>` 테이블 없음)은 **오류가 아니라 빈 결과**다.
        //    boardId 는 영숫자면 통과하므로 `undefined`·`bbs` 같은 값이 정상 slug 처럼 들어온다.
        //    이걸 500 + console.error 로 처리하면 운영 로그가 시끄러워져
        //    **진짜 장애를 덮는다.** 좋아요 상태가 없는 게시판 = 빈 목록이 맞는 답이다.
        //    ⭐ 그 외 오류(연결 끊김·문법 등)는 그대로 시끄럽게 둔다.
        if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
            return json({ success: true, data: { likedIds: [], dislikedIds: [] } });
        }
        console.error('comment like-statuses 조회 실패:', err);
        return json({ success: false, data: { likedIds: [], dislikedIds: [] } }, { status: 500 });
    }
};

import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { Board } from '$lib/api/types.js';
import { backendFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';
import { enforceCanonicalBoardPath } from '$lib/server/board-slug.js';

/**
 * 게시글 수정 페이지 서버 로드
 * 인증 체크 (로그인 필수) + write_level 권한 체크 + 작성자 본인 확인
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
    const { boardId, postId } = params;
    enforceCanonicalBoardPath(boardId, url);

    // 서버 사이드 인증 검증 — 미인증 사용자는 로그인 페이지로 리다이렉트
    if (!locals.user) {
        redirect(302, `/login?redirect=/${boardId}/${postId}/edit`);
    }

    const headers = createAuthHeaders(locals.accessToken);
    const userLevel = locals.user.level ?? 0;

    // 게시판 정보 조회 → write_level 권한 체크
    try {
        const boardRes = await backendFetch(`/api/v1/boards/${boardId}`, { headers });
        const board: Board | null = boardRes.ok ? ((await boardRes.json()).data as Board) : null;

        if (board) {
            const requiredLevel = board.write_level ?? 1;
            const isSuperAdmin = userLevel >= 10;
            if (!isSuperAdmin && userLevel < requiredLevel) {
                error(403, '이 게시판에 글을 작성할 권한이 없습니다.');
            }
        }
    } catch (err) {
        // SvelteKit HttpError (403 등)는 다시 throw
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
    }

    // 게시글 조회 → 작성자 본인 확인 (관리자 레벨 10 이상은 통과)
    if (userLevel < 10) {
        try {
            const postRes = await backendFetch(`/api/v1/boards/${boardId}/posts/${postId}`, {
                headers
            });
            if (postRes.ok) {
                const postData = (await postRes.json()).data;
                const authorId = postData?.author_id || postData?.mb_id || '';
                if (authorId && authorId !== locals.user.id) {
                    error(403, '본인이 작성한 글만 수정할 수 있습니다.');
                }
            } else if (postRes.status === 404) {
                error(404, '게시글을 찾을 수 없습니다.');
            }
        } catch (err) {
            if (err && typeof err === 'object' && 'status' in err) {
                throw err;
            }
        }
    }

    return {};
};

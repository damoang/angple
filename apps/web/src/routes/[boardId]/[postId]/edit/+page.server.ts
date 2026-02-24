import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { Board } from '$lib/api/types.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

/**
 * 게시글 수정 페이지 서버 로드
 * 인증 체크 (로그인 필수) + write_level 권한 체크
 */
export const load: PageServerLoad = async ({ locals, params }) => {
    const { boardId, postId } = params;

    // 서버 사이드 인증 검증 — 미인증 사용자는 로그인 페이지로 리다이렉트
    if (!locals.user) {
        redirect(302, `/login?redirect=/${boardId}/${postId}/edit`);
    }

    // 게시판 정보 조회 → write_level 권한 체크
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (locals.accessToken) {
            headers['Authorization'] = `Bearer ${locals.accessToken}`;
        }

        const backendFetch = globalThis.fetch;
        const boardRes = await backendFetch(`${BACKEND_URL}/api/v1/boards/${boardId}`, { headers });
        const board: Board | null = boardRes.ok ? ((await boardRes.json()).data as Board) : null;

        if (board) {
            const userLevel = locals.user.level ?? 0;
            const requiredLevel = board.write_level ?? 1;
            if (userLevel < requiredLevel) {
                error(403, '이 게시판에 글을 작성할 권한이 없습니다.');
            }
        }
    } catch (err) {
        // SvelteKit HttpError (403 등)는 다시 throw
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        // 게시판 정보 조회 실패는 무시 (CSR에서 재확인)
    }

    return {};
};

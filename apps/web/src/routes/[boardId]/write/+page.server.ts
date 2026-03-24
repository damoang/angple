import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { Board } from '$lib/api/types.js';
import { backendFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';
import { checkCertification } from '$lib/server/certification.js';
import { resolveCanonicalBoardId } from '$lib/server/board-cache.js';

/**
 * 글쓰기 페이지 서버 로드
 * 인증 체크 (로그인 필수) + write_level 권한 체크
 */
export const load: PageServerLoad = async ({ locals, params }) => {
    const canonicalBoardId = await resolveCanonicalBoardId(params.boardId);
    if (canonicalBoardId !== params.boardId) {
        redirect(301, `/${canonicalBoardId}/write`);
    }

    const boardId = canonicalBoardId;

    // 서버 사이드 인증 검증 — 미인증 사용자는 로그인 페이지로 리다이렉트
    if (!locals.user) {
        redirect(302, `/login?redirect=/${boardId}/write`);
    }

    const certError = await checkCertification(boardId, locals.user.id);
    if (certError) {
        redirect(302, '/register/cert');
    }

    // 게시판 정보 조회 → write_level 권한 체크
    try {
        const headers = createAuthHeaders(locals.accessToken);

        const boardRes = await backendFetch(`/api/v1/boards/${boardId}`, { headers });
        const board: Board | null = boardRes.ok ? ((await boardRes.json()).data as Board) : null;

        if (board) {
            const userLevel = locals.user.level ?? 0;
            const isSuperAdmin = userLevel >= 10;
            const requiredLevel = board.write_level ?? 1;
            if (!isSuperAdmin && userLevel < requiredLevel) {
                error(403, '이 게시판에 글을 작성할 권한이 없습니다.');
            }
        }

        // ExtendedSettings 기반 글쓰기 제한 체크 (서버 사이드 사전 검증, 최고관리자 제외)
        const isSuperAdmin = (locals.user.level ?? 0) >= 10;
        if (locals.accessToken && !isSuperAdmin) {
            try {
                const permRes = await backendFetch(`/api/v1/boards/${boardId}/write-permission`, {
                    headers
                });
                if (permRes.ok) {
                    const permData = await permRes.json();
                    if (permData.data && !permData.data.can_write) {
                        error(
                            403,
                            permData.data.reason || '글쓰기 제한에 의해 작성할 수 없습니다.'
                        );
                    }
                }
            } catch (permErr) {
                // SvelteKit HttpError는 다시 throw
                if (permErr && typeof permErr === 'object' && 'status' in permErr) {
                    throw permErr;
                }
                // 권한 조회 실패는 무시 (클라이언트에서 재확인)
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

/**
 * 게시글 처리 상태(해결됨·진행중·보류) 지정/해제 — 관리자 전용 프록시
 * PUT    /api/boards/[boardId]/posts/[postId]/status   { status: 'resolved'|'in_progress'|'hold' }
 * DELETE /api/boards/[boardId]/posts/[postId]/status
 *
 * 카테고리(ca_name)와 독립인 상태 배지. 저장·목록 캐시 무효화는 백엔드
 * (PUT/DELETE /api/v1/boards/:slug/posts/:id/status, RequireAdmin)가 맡고,
 * 여기서는 세션의 액세스 토큰을 붙여 넘긴다. 권한은 백엔드가 최종 판정한다.
 * 설계: docs/2026-09-28-bug-status-badge-sprint.html
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { backendFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';

const ALLOWED = new Set(['resolved', 'in_progress', 'hold']);

async function forward(
    method: 'PUT' | 'DELETE',
    boardId: string,
    postId: string,
    accessToken: string,
    body?: unknown
): Promise<Response> {
    const res = await backendFetch(`/api/v1/boards/${boardId}/posts/${postId}/status`, {
        method,
        headers: {
            ...createAuthHeaders(accessToken),
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    return new Response(text, {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export const PUT: RequestHandler = async ({ params, request, locals }) => {
    if (!locals.accessToken || (locals.user?.level ?? 0) < 10) {
        return json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }
    let status = '';
    try {
        const body = (await request.json()) as { status?: string };
        status = String(body?.status ?? '');
    } catch {
        /* 아래에서 400 */
    }
    if (!ALLOWED.has(status)) {
        return json(
            { success: false, error: 'status 는 resolved, in_progress, hold 중 하나여야 합니다.' },
            { status: 400 }
        );
    }
    return forward('PUT', params.boardId, params.postId, locals.accessToken, { status });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    if (!locals.accessToken || (locals.user?.level ?? 0) < 10) {
        return json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }
    return forward('DELETE', params.boardId, params.postId, locals.accessToken);
};

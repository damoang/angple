/**
 * 게시글 리액션 API (레거시 호환 - /api/reactions로 프록시)
 * 실제 로직은 /api/reactions에서 처리
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
    const { boardId, postId } = params;
    const targetId = `document:${boardId}:${postId}`;
    const res = await fetch(`/api/reactions?targetId=${encodeURIComponent(targetId)}`);
    return json(await res.json());
};

export const POST: RequestHandler = async ({ params, request, fetch }) => {
    const { boardId, postId } = params;
    const body = await request.json();
    const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...body,
            targetId: `document:${boardId}:${postId}`,
            parentId: `document:${boardId}:${postId}`
        })
    });
    return json(await res.json());
};

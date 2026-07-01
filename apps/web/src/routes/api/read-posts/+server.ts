/**
 * GET /api/read-posts
 *
 * 로그인 회원의 서버 read-set(L2, Redis)을 반환합니다.
 * 클라이언트가 hydration 후 1회 호출해 localStorage(L1)에 병합 → 크로스기기 읽음 표시.
 * per-user 개인 데이터이므로 캐시 금지(private, no-store).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReadPosts } from '$lib/server/read-posts';

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    const mbId = locals.user?.id;
    if (!mbId) {
        return json({ posts: [] });
    }

    const posts = await getReadPosts(mbId);
    return json({ posts });
};

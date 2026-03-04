/**
 * 새글 모아보기 페이지 서버 — Streaming SSR
 *
 * groups: 즉시 반환 (캐시됨, 필터 UI 렌더링)
 * posts: 스트리밍 (Promise, 스켈레톤 → 데이터)
 */
import type { PageServerLoad } from './$types';
import { getNewPosts, getBoardGroups } from '$lib/server/new-posts.js';

export const load: PageServerLoad = async ({ url }) => {
    const view = (url.searchParams.get('view') as string) || '';
    const grId = url.searchParams.get('gr_id') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const cursor = parseInt(url.searchParams.get('cursor') || '0', 10) || undefined;
    const perPage = 30;

    // groups는 캐시됨 → 즉시 await (필터 UI 바로 렌더링)
    const groups = await getBoardGroups();

    // posts는 스트리밍 → await 하지 않음 (스켈레톤 먼저 보여줌)
    const postsPromise = getNewPosts(view, grId, page, perPage, cursor);

    return {
        /** 스트리밍: Promise로 반환 → 클라이언트에서 {#await} 사용 */
        streamed: {
            posts: postsPromise
        },
        groups,
        currentView: view,
        currentGroup: grId,
        page,
        perPage
    };
};

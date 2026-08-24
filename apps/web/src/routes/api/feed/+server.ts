/**
 * 새글 피드 데이터 API (JSON).
 * /free?all=1 (제자리 토글) 등에서 클라이언트가 피드를 불러올 때 사용.
 * getNewPosts 는 서버 전용(new-posts.ts)이라 클라에서 직접 못 쓰므로 이 얇은 래퍼로 노출한다.
 * 반환 데이터는 이미 /feed 에서 공개되는 것과 동일 → 새 노출 없음. 10초 캐시.
 */
import type { RequestHandler } from './$types.js';
import { getNewPosts, type FeedSort } from '$lib/server/new-posts.js';

const SCOPES = new Set(['', 'nofree']);
const VIEWS = new Set(['', 'w', 'c']);
const SORTS = new Set(['latest', 'comments', 'views']);

export const GET: RequestHandler = async ({ url }) => {
    const rawView = url.searchParams.get('view') || '';
    const view = VIEWS.has(rawView) ? rawView : '';
    const rawScope = url.searchParams.get('scope') || '';
    const scope = SCOPES.has(rawScope) ? rawScope : '';
    const rawSort = url.searchParams.get('sort') || 'latest';
    const sort = (SORTS.has(rawSort) ? rawSort : 'latest') as FeedSort;
    // 7일 창 피드라 페이지 수는 많아야 수천. 비정상적으로 큰 offset(정수/DB 부하) 방어로 상한.
    const page = Math.min(
        100000,
        Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    );
    const grId = url.searchParams.get('gr_id') || '';
    const cursor = parseInt(url.searchParams.get('cursor') || '0', 10) || undefined;
    const perPage = 30;

    try {
        const result = await getNewPosts(view, grId, page, perPage, cursor, sort, scope);
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=10'
            }
        });
    } catch (error) {
        console.error('피드 API 조회 실패:', error);
        return new Response(JSON.stringify({ items: [], total: 0, nextCursor: null }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

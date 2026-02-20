/**
 * 게시글 목록 데이터 API
 *
 * post-list 위젯이 사용하는 데이터 엔드포인트.
 * Query params: board, sort, count, filter
 *
 * 백엔드 개별 게시판 API를 직접 호출하여 데이터를 제공합니다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchBoardPostsForWidget } from '$lib/server/index-widgets-builder';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8082';

export const GET: RequestHandler = async ({ url }) => {
    const board = url.searchParams.get('board') ?? 'notice';
    const sort = url.searchParams.get('sort') ?? 'date';
    const count = parseInt(url.searchParams.get('count') ?? '10', 10);
    const filter = url.searchParams.get('filter') ?? 'none';

    try {
        const rawPosts = await fetchBoardPostsForWidget(BACKEND_URL, board, count);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic widget data from various board types
        let posts: any[] = rawPosts.map((p) => ({
            id: p.id,
            title: p.title,
            author: p.author,
            created_at: p.created_at,
            comment_count: p.comments_count,
            view_count: p.views,
            recommend_count: p.likes,
            thumbnail_url: p.thumbnail,
            url: `/${board}/${p.id}`
        }));

        // 정렬
        if (sort !== 'date') {
            posts = [...posts].sort((a, b) => {
                switch (sort) {
                    case 'recommend':
                        return (b.recommend_count ?? 0) - (a.recommend_count ?? 0);
                    case 'comment':
                        return (b.comment_count ?? 0) - (a.comment_count ?? 0);
                    case 'hit':
                        return (b.view_count ?? 0) - (a.view_count ?? 0);
                    default:
                        return 0;
                }
            });
        }

        // 필터
        if (filter === 'recommended') {
            posts = posts.filter((p) => (p.recommend_count ?? 0) > 0);
        } else if (filter === 'has-image') {
            posts = posts.filter((p) => p.thumbnail_url);
        }

        // 개수 제한
        posts = posts.slice(0, count);

        return json({ success: true, posts, total: posts.length });
    } catch (error) {
        console.error('[post-list API] 데이터 로드 실패:', error);
        return json({ success: false, posts: [], error: '데이터 로드 실패' }, { status: 500 });
    }
};

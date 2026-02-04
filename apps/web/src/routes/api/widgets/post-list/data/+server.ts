/**
 * 게시글 목록 데이터 API
 *
 * post-list 위젯이 사용하는 데이터 엔드포인트.
 * Query params: board, sort, count, filter
 *
 * 현재는 indexWidgetsStore의 mock/backend 데이터를 재활용합니다.
 * 백엔드 API가 완성되면 직접 호출로 전환합니다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiClient } from '$lib/api';

export const GET: RequestHandler = async ({ url }) => {
    const board = url.searchParams.get('board') ?? 'notice';
    const sort = url.searchParams.get('sort') ?? 'date';
    const count = parseInt(url.searchParams.get('count') ?? '10', 10);
    const filter = url.searchParams.get('filter') ?? 'none';

    try {
        // 기존 인덱스 위젯 데이터를 활용
        const widgetsData = await apiClient.getIndexWidgets();

        if (!widgetsData) {
            return json({ posts: [], board, sort, count });
        }

        let posts: unknown[] = [];

        switch (board) {
            case 'notice':
                posts = widgetsData.news_tabs ?? [];
                break;
            case 'economy':
                posts = widgetsData.economy_tabs ?? [];
                break;
            case 'gallery':
                posts = widgetsData.gallery ?? [];
                break;
            case 'group': {
                const groupData = widgetsData.group_tabs;
                // group은 탭별 데이터 → 전체 합침
                posts = groupData ? [...(groupData.all ?? []), ...(groupData['24h'] ?? [])] : [];
                break;
            }
            default:
                // 알 수 없는 게시판은 빈 배열
                posts = [];
        }

        // 정렬
        if (sort !== 'date') {
            posts = [...posts].sort((a: any, b: any) => {
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
            posts = posts.filter((p: any) => (p.recommend_count ?? 0) > 0);
        } else if (filter === 'has-image') {
            posts = posts.filter((p: any) => p.thumbnail_url);
        }

        // 개수 제한
        posts = posts.slice(0, count);

        return json({ success: true, posts, total: posts.length });
    } catch (error) {
        console.error('[post-list API] 데이터 로드 실패:', error);
        return json({ success: false, posts: [], error: '데이터 로드 실패' }, { status: 500 });
    }
};

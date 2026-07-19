/**
 * 앙티티 작품 전용 페이지 — SSR 로드
 *
 * 플러그인(angtt-review)은 HTML 라우트를 제공할 수 없어, 얇은 코어 라우트가
 * 플러그인 lib 을 직접 위임 호출한다($plugins 별칭 = ../../plugins).
 *
 * 커뮤니티 우선: 헤드라인은 우리 별점 + 앙님 후기(추천순). 읽기 전용 슬라이스라
 * 별점 데이터는 0건이 정상이며, 그때는 빈 상태(첫 후기·첫 별점 유도)를 보여준다.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import {
    getEntityBySlug,
    getEntityConnectedPosts,
    getEntityRating
} from '$plugins/angtt-review/lib/entities.server';

export const load: PageServerLoad = async ({ params, locals }) => {
    const slug = params.slug;

    const entity = await getEntityBySlug(slug);
    if (!entity || entity.status !== 'active') {
        throw error(404, '작품을 찾을 수 없습니다.');
    }

    const [posts, rating] = await Promise.all([
        getEntityConnectedPosts(entity.id, { sort: 'best', limit: 20 }),
        getEntityRating(entity.id, locals.user?.id)
    ]);

    return { entity, posts, rating };
};

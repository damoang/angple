/**
 * GET /api/plugins/angtt-review/entities/:slug
 *
 * 작품 슬러그로 작품 + 커뮤니티 별점 + 연결된 앙님 후기(추천순)를 반환한다.
 * plugin.json 의 rest 라우트가 이 핸들러를 가리킨다(코어 lib 위임 · 읽기 전용).
 */
import {
    getEntityBySlug,
    getEntityConnectedPosts,
    getEntityRating,
    type AngttEntity,
    type AngttConnectedPost,
    type AngttEntityRating
} from '../lib/entities.server';

export interface EntityApiResult {
    entity: AngttEntity;
    rating: AngttEntityRating;
    posts: AngttConnectedPost[];
}

/**
 * 작품 조회 핸들러. 미존재/비활성 작품은 null(404 매핑용).
 */
export async function getEntity(
    slug: string,
    opts: { mbId?: string; limit?: number } = {}
): Promise<EntityApiResult | null> {
    const entity = await getEntityBySlug(slug);
    if (!entity || entity.status !== 'active') return null;

    const [posts, rating] = await Promise.all([
        getEntityConnectedPosts(entity.id, { sort: 'best', limit: opts.limit ?? 20 }),
        getEntityRating(entity.id, opts.mbId)
    ]);

    return { entity, rating, posts };
}

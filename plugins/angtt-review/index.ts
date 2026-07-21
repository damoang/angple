/**
 * 앙티티 리뷰 플러그인 메인 엔트리
 *
 * 작품 전용 페이지의 서버 로직을 재노출한다. HTML 라우트는 플러그인이 제공할 수
 * 없어 코어(apps/web/src/routes/angtt/[slug])에 얇게 두고, 이 lib 을 위임 호출한다.
 */

// 순수 정규화 로직
export { ANGTT_TAG, normalizeWorkTitle, hasAngttTag } from './lib/normalize';

// 작품(엔티티) 조회 서버 로직
export {
    resolveEntityByTags,
    getEntityBySlug,
    getEntityConnectedPosts,
    getEntityRating,
    ENTITY_RATING_BO_TABLE
} from './lib/entities.server';

export type {
    AngttEntity,
    AngttConnectedPost,
    AngttEntityRating,
    ResolveEntityResult
} from './lib/entities.server';

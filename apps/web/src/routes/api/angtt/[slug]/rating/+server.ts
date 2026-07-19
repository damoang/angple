/**
 * 앙티티 작품 별점 API — 작품 단위 회원 1표(GET 내 별점 / PUT 등록·수정).
 *
 * 플러그인(angtt-review)은 REST 라우트를 제공할 수 없어(작품 페이지와 동일한 사유)
 * 얇은 코어 라우트가 플러그인 lib 을 위임 호출한다. 저장 규약은
 * angple_post_ratings(bo_table='@entity', wr_id=entity_id) — PK 로 작품당 1표 보장.
 *
 * 권한 게이트 정합: 기존 게시글 별점(be#562)과 동일하게 "로그인 + 앙님💛(mb_level 3)
 * 이상"을 적용한다. 최소 등급 상수(RATING_MIN_LEVEL)와 거부 안내 문구
 * (buildGradeDeniedMessage)를 그대로 재사용해 관례를 단일 소스로 유지한다.
 * (locals.user.level = mb_level, hooks.server.ts 참조.)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getEntityBySlug,
    getEntityRating,
    putEntityRating
} from '$plugins/angtt-review/lib/entities.server';
import { RATING_MIN_LEVEL } from '$lib/components/features/board/post-rating-logic.js';
import { buildGradeDeniedMessage } from '$lib/utils/board-permissions.js';

/**
 * GET /api/angtt/:slug/rating
 * 작품 별점 집계 + 본인 표. 비로그인이면 my=null.
 */
export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    const entity = await getEntityBySlug(params.slug);
    if (!entity || entity.status !== 'active') {
        return json({ error: '작품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const rating = await getEntityRating(entity.id, locals.user?.id);
    return json(rating);
};

/**
 * PUT /api/angtt/:slug/rating  body: { rating: 1~5 }
 * 로그인 + 앙님💛(mb_level 3) 이상 필요. 갱신된 {avg, count, my} 반환.
 */
export const PUT: RequestHandler = async ({ params, locals, request, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    // 인증 필수
    const mbId = locals.user?.id;
    if (!mbId) {
        return json({ error: '별점을 남기려면 로그인이 필요해요.' }, { status: 401 });
    }

    // 등급 게이트(be#562 관례: 로그인 + mb_level >= RATING_MIN_LEVEL)
    const level = locals.user?.level ?? 1;
    if (level < RATING_MIN_LEVEL) {
        return json(
            { error: buildGradeDeniedMessage('별점 남기기', RATING_MIN_LEVEL, level) },
            { status: 403 }
        );
    }

    // 본문 파싱
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '요청 본문을 해석할 수 없어요.' }, { status: 400 });
    }
    const raw = (body as { rating?: unknown } | null)?.rating;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
        return json({ error: '별점은 1~5 사이여야 해요.' }, { status: 400 });
    }

    // 작품 조회
    const entity = await getEntityBySlug(params.slug);
    if (!entity || entity.status !== 'active') {
        return json({ error: '작품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const rating = await putEntityRating(entity.id, mbId, value);
    return json(rating);
};

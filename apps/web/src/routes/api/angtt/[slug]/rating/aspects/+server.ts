/**
 * 앙티티 작품 항목별 평점 API — PUT(행별 등록·수정, 부분 입력 허용).
 *
 * 총점 별점(../+server.ts)의 부가 경로: 항목별 평가는 "총점의 세부"라는 규약이라
 * **본인 총점(getEntityRating().my)이 있는 회원만** 허용한다. 저장 규약은
 * angple_rating_aspects(bo_table='@entity', wr_id=entity_id) — PK 로
 * 회원당 작품당 항목당 1표 보장. 프리셋(aspect-presets.ts) 화이트리스트 밖
 * aspect 키·1~5 범위 밖 값은 저장 자체를 거부한다.
 *
 * 권한 게이트는 총점과 동일: 로그인 + 앙님💛(mb_level 3) 이상
 * (RATING_MIN_LEVEL·buildGradeDeniedMessage 재사용, 단일 소스 유지).
 * 조회는 별도 GET 없이 작품 페이지 SSR(getEntityAspects 편승)이 담당한다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getEntityBySlug,
    getEntityRating,
    putEntityAspects
} from '$plugins/angtt-review/lib/entities.server';
import { validateAspects } from '$plugins/angtt-review/lib/aspect-presets';
import { RATING_MIN_LEVEL } from '$lib/components/features/board/post-rating-logic.js';
import { buildGradeDeniedMessage } from '$lib/utils/board-permissions.js';

/**
 * PUT /api/angtt/:slug/rating/aspects  body: { aspects: { story: 4, ... } }
 * 로그인 + 앙님💛(mb_level 3) 이상 + 본인 총점 별점 보유 필요.
 * 갱신된 { aspects: [{aspect, avg, count, my}] } 반환.
 */
export const PUT: RequestHandler = async ({ params, locals, request, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    // 인증 필수
    const mbId = locals.user?.id;
    if (!mbId) {
        return json({ error: '항목별 평가를 남기려면 로그인이 필요해요.' }, { status: 401 });
    }

    // 등급 게이트(총점 별점과 동일: 로그인 + mb_level >= RATING_MIN_LEVEL)
    const level = locals.user?.level ?? 1;
    if (level < RATING_MIN_LEVEL) {
        return json(
            { error: buildGradeDeniedMessage('항목별 평가', RATING_MIN_LEVEL, level) },
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
    const raw = (body as { aspects?: unknown } | null)?.aspects;

    // 작품 조회
    const entity = await getEntityBySlug(params.slug);
    if (!entity || entity.status !== 'active') {
        return json({ error: '작품을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 프리셋 화이트리스트 + 1~5 범위 검증 (밖이면 전체 거부)
    const validated = validateAspects(entity.type, raw);
    if (!validated.ok) {
        return json({ error: validated.error }, { status: 400 });
    }

    // 본인 총점 게이트 — 항목별 평가는 총점의 부가라는 규약
    const rating = await getEntityRating(entity.id, mbId);
    if (rating.my == null) {
        return json(
            { error: '먼저 작품 별점(총점)을 남긴 뒤 항목별 평가를 남길 수 있어요.' },
            { status: 403 }
        );
    }

    const aspects = await putEntityAspects(entity.id, entity.type, mbId, validated.aspects);
    return json({ aspects });
};

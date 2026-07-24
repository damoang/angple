/**
 * 앙티티 작품 항목별 평점 API — PUT(행별 등록·수정, 부분 입력 허용).
 *
 * 총점 별점(../+server.ts)의 부가 경로: 항목별 평가는 "총점의 세부"라는 규약이라
 * **본인 총점(getEntityRating().my)이 있는 회원만** 허용한다. 저장 규약은
 * angple_rating_aspects(bo_table='@entity', wr_id=entity_id) — PK 로
 * 회원당 작품당 항목당 1표 보장. 프리셋(aspect-presets.ts) 화이트리스트 밖
 * aspect 키·1~5 범위 밖 값은 저장 자체를 거부한다.
 *
 * 인증·등급 게이트·검증·총점 게이트·응답은 공유 핸들러(handleAspectsPut)에 위임하고,
 * 여기서는 앙티티 고유의 대상 해석(entities.server)만 target 으로 넘긴다.
 * 규약은 일반 게시판 경로(api/boards/[boardId]/[postId]/rating/aspects)와 단일 소스.
 */
import type { RequestHandler } from './$types';
import {
    getEntityBySlug,
    getEntityRating,
    putEntityAspects
} from '$plugins/angtt-review/lib/entities.server';
import { getAspectPreset } from '$plugins/angtt-review/lib/aspect-presets';
import { handleAspectsPut } from '$lib/server/rating-aspects.js';

/**
 * PUT /api/angtt/:slug/rating/aspects  body: { aspects: { story: 4, ... } }
 * 로그인 + 앙님💛(mb_level 3) 이상 + 본인 총점 별점 보유 필요.
 * 갱신된 { aspects: [{aspect, avg, count, my}] } 반환.
 */
export const PUT: RequestHandler = async (event) => {
    const { params } = event;
    return handleAspectsPut(event, async () => {
        const entity = await getEntityBySlug(params.slug);
        if (!entity || entity.status !== 'active') {
            return {
                available: false,
                preset: null,
                notFoundMessage: '작품을 찾을 수 없습니다.',
                hasTotalRating: async () => false,
                upsert: async () => []
            };
        }
        return {
            available: true,
            preset: getAspectPreset(entity.type),
            hasTotalRating: async (mbId: string) =>
                (await getEntityRating(entity.id, mbId)).my != null,
            noTotalRatingMessage: '먼저 작품 별점(총점)을 남긴 뒤 항목별 평가를 남길 수 있어요.',
            upsert: (mbId: string, aspects) =>
                putEntityAspects(entity.id, entity.type, mbId, aspects)
        };
    });
};

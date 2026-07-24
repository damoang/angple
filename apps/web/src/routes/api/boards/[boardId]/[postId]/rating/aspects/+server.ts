/**
 * 일반 게시판 항목별 평점 API — PUT(행별 등록·수정, 부분 입력 허용) — 범용 경로.
 *
 * 앙지도(angmap) 등 features.rating 을 켠 게시판에서 총점 별점의 세부(맛/가성비 등)를
 * 남긴다. 앙티티 전용 경로(api/angtt/[slug]/rating/aspects)와 **동일한 공유 핸들러**를
 * 쓰되, 대상 해석만 게시판/글 기준으로 바꾼다(bo_table=boardId, wr_id=postId).
 *
 * 규약(공유 핸들러가 강제):
 *   (a) 본인 총점(angple_post_ratings) 없는 회원의 항목별 PUT 거부(403)
 *   (b) 프리셋 화이트리스트 밖 aspect 키 거부(400) — 자유텍스트 오염 차단
 *   (c) features.rating 을 켠 보드 + 프리셋이 매핑된 보드만 허용(그 외 404)
 * 저장 테이블 angple_rating_aspects — DDL 없음.
 */
import type { RequestHandler } from './$types';
import { getBoardAspectPreset } from '$plugins/angtt-review/lib/aspect-presets';
import {
    boardHasRatingFeature,
    hasPostTotalRating,
    putPostAspects,
    handleAspectsPut
} from '$lib/server/rating-aspects.js';

/**
 * PUT /api/boards/:boardId/:postId/rating/aspects  body: { aspects: { taste: 4, ... } }
 * 로그인 + 앙님💛(mb_level 3) 이상 + 본인 총점 별점 보유 + features.rating 보드 필요.
 * 갱신된 { aspects: [{aspect, avg, count, my}] } 반환.
 */
export const PUT: RequestHandler = async (event) => {
    const { params } = event;
    return handleAspectsPut(event, async () => {
        const boardId = params.boardId;
        const wrId = Number(params.postId);
        const preset = getBoardAspectPreset(boardId);

        // 프리셋이 없으면(항목별 미지원 보드) features.rating 조회 없이 즉시 미지원 처리.
        if (!preset || !Number.isFinite(wrId) || wrId <= 0) {
            return {
                available: false,
                preset: null,
                notFoundMessage: '이 게시판은 항목별 평가를 지원하지 않아요.',
                hasTotalRating: async () => false,
                upsert: async () => []
            };
        }

        const featureOn = await boardHasRatingFeature(boardId);
        return {
            available: featureOn,
            preset,
            notFoundMessage: '이 게시판은 항목별 평가를 지원하지 않아요.',
            hasTotalRating: (mbId: string) => hasPostTotalRating(boardId, wrId, mbId),
            upsert: (mbId: string, aspects) => putPostAspects(boardId, wrId, mbId, aspects)
        };
    });
};

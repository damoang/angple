/**
 * 앙티티 작품 사전 동기화 — 내부 전용 (A단계, 수동 호출).
 *
 * TMDB 개봉작을 받아 `angple_entities` 에 없는 작품만 `status='pending'` 으로 넣는다.
 * 자동 활성화(`auto_link`)는 B단계에서 별도로 판단한다 — 여기서는 켜지 않는다.
 *
 * ⛔ 응답에 처리 건수를 **반드시** 싣는다. 이 프로젝트에는 "없는 라우트도 200
 *    `{"data":null}` 을 돌려주는" 함정이 있어(경로 오타 = silent 200), 배포 후
 *    `{"success":true}` 만 보고 "돌았구나" 하면 몇 주를 모르고 지나간다.
 *    호출 후 `result.message` 에 실제 숫자가 찍히는지 눈으로 확인할 것.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncAngttCatalog } from '$lib/server/angtt-catalog-sync';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api';

export const POST: RequestHandler = async ({ request }) => {
    if (!isInternalAppRequest(request)) {
        return internalOnlyErrorResponse();
    }

    try {
        const result = await syncAngttCatalog();
        return json({ success: true, result });
    } catch (error) {
        console.error('[angtt-catalog] 동기화 실패:', error);
        return json(
            {
                success: false,
                message: error instanceof Error ? error.message : '동기화에 실패했습니다.'
            },
            { status: 500 }
        );
    }
};

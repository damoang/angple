/**
 * 마음메시지 배너 API
 *
 * ⛔ 2026-09-28: 이 핸들러는 조회 로직 **사본**을 갖고 있었고 정본($lib/server/celebration.ts)과
 *    네 곳이 어긋나 있었다 — yearly_repeat 누락(정본) · updated_at 캐시버스터 누락(정본) ·
 *    원본 글 최신 이미지 미반영(정본) · ORDER BY 상이.
 *    그 결과 SSR 과 이 API 가 **같은 이미지 파일을 다른 URL** 로 내보내(ETag 동일)
 *    브라우저가 하이드레이션 후 같은 파일을 한 번 더 받았고,
 *    메인 페이지 LCP p75 가 1,104 → 1,931ms(+75%), 모바일은 +42% 가 되었다.
 *
 * ⭐ 그래서 사본을 지우고 정본을 호출한다. **여기에 질의를 다시 만들지 마라.**
 *    SSR(+layout.server.ts)과 이 API 는 반드시 같은 문자열의 image_url 을 내야 한다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedCelebrations } from '$lib/server/celebration';

export const GET: RequestHandler = async () => {
    try {
        // isRecent=false → 오늘(KST)자만. 1차 celebration_banners → 2차 g5_write_message 폴백까지
        // 정본 모듈이 처리한다(60초 인메모리 캐시 + singleflight 포함).
        const banners = await getCachedCelebrations(false);

        return json(
            { success: true, data: banners },
            { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
        );
    } catch (error) {
        console.error('Banner API error:', error);
        return json(
            {
                success: false,
                data: [],
                error: 'Failed to fetch banners'
            },
            { status: 500 }
        );
    }
};

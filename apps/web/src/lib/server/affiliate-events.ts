/**
 * 제휴 링크 변환 이벤트 전송
 *
 * ads 서버의 POST /api/v1/serve/affiliate-events 로 이벤트를 전송합니다.
 * fire-and-forget 방식: 전송 실패해도 변환 기능에 영향 없음.
 */

import type { AffiliateEvent } from '$plugins/affiliate-link/lib/types';
import { getAdsServerUrl } from './ads/config.js';

/**
 * 제휴 링크 변환 이벤트를 ads 서버로 배치 전송
 *
 * @param events - 변환 이벤트 배열
 */
export async function sendAffiliateEvents(events: AffiliateEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
        const url = `${getAdsServerUrl()}/api/v1/serve/affiliate-events`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events }),
            signal: AbortSignal.timeout(5_000)
        });
        // 응답 확인 불필요 (fire-and-forget)
    } catch {
        // 전송 실패 무시 — 통계 손실은 OK, 변환은 정상 동작
    }
}

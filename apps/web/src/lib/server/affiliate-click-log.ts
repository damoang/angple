/**
 * 어필리에이트 클릭 로깅
 *
 * /go 리다이렉트 엔드포인트에서 호출하여
 * 클릭 이벤트를 ads 서버로 전송합니다.
 * 항소 시 "정상 사용자의 자발적 클릭" 증명에 활용됩니다.
 */

import { createHash } from 'node:crypto';
import { getAdsServerUrl } from '$lib/server/ads/config';

export interface AffiliateClickEvent {
    timestamp: string;
    user_id_hash: string;
    ip_hash: string;
    user_agent: string;
    referrer: string;
    target_url: string;
    platform: string;
    board: string;
    post_id: number;
}

function hashValue(value: string): string {
    if (!value) return '';
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export async function logAffiliateClick(event: {
    userId?: string;
    ip: string;
    userAgent: string;
    referrer: string;
    targetUrl: string;
    platform: string;
    board: string;
    postId: number;
}): Promise<void> {
    const payload: AffiliateClickEvent = {
        timestamp: new Date().toISOString(),
        user_id_hash: hashValue(event.userId || ''),
        ip_hash: hashValue(event.ip),
        user_agent: event.userAgent,
        referrer: event.referrer,
        target_url: event.targetUrl,
        platform: event.platform,
        board: event.board,
        post_id: event.postId
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
        await fetch(`${getAdsServerUrl()}/api/v1/serve/affiliate-clicks`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
    } catch {
        // fail-open: 클릭 로깅 실패가 리다이렉트를 막지 않음
    } finally {
        clearTimeout(timeout);
    }
}

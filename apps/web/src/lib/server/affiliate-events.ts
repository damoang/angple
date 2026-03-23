import { createHash, randomUUID } from 'node:crypto';
import { getAdsServerUrl } from '$lib/server/ads/config';
import type { BatchConvertResponse, ConvertResponse } from '$plugins/affiliate-link/lib/types';
import type { AffiliateDecision, AffiliateSource } from '$plugins/affiliate-link-private/lib/types';

type AffiliateEventType = 'success' | 'failure' | 'cache_hit';

type AffiliateEventPayload = {
    event_type: AffiliateEventType;
    platform: string;
    merchant_domain: string;
    original_url: string;
    affiliate_url: string;
    board: string;
    post_id: number;
    source: string;
    entity_type: string;
    entity_id: string;
    request_id: string;
    dedupe_key: string;
    error_message: string;
    latency_ms: number;
};

function getMerchantDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function buildEventType(result: ConvertResponse): AffiliateEventType | null {
    if (result.converted && result.cached) return 'cache_hit';
    if (result.converted) return 'success';
    if (result.error) return 'failure';
    return null;
}

function buildDedupeKey(parts: string[]): string {
    return createHash('sha256').update(parts.join('|')).digest('hex');
}

function buildPayload(
    result: ConvertResponse,
    requestId: string,
    source: string,
    boTable?: string,
    wrId?: number,
    latencyMs = 0
): AffiliateEventPayload | null {
    const eventType = buildEventType(result);
    if (!eventType || !result.platform) return null;

    const originalUrl = result.original || result.url;
    const affiliateUrl = result.converted ? result.url : '';
    const postId = wrId ?? 0;

    return {
        event_type: eventType,
        platform: result.platform,
        merchant_domain: getMerchantDomain(originalUrl),
        original_url: originalUrl,
        affiliate_url: affiliateUrl,
        board: boTable ?? '',
        post_id: postId,
        source,
        entity_type: postId ? 'post' : '',
        entity_id: postId ? String(postId) : '',
        request_id: requestId,
        dedupe_key: buildDedupeKey([
            eventType,
            source,
            boTable ?? '',
            String(postId),
            originalUrl,
            affiliateUrl
        ]),
        error_message: result.error ?? '',
        latency_ms: latencyMs
    };
}

export async function sendAffiliateEvents(
    results: ConvertResponse[] | BatchConvertResponse,
    opts: {
        source: 'api_convert' | 'api_batch' | 'server_content' | 'server_link_field';
        bo_table?: string;
        wr_id?: number;
        latency_ms?: number;
    }
): Promise<void> {
    const list = Array.isArray(results) ? results : results.results;
    const requestId = randomUUID();
    const events = list
        .map((result) =>
            buildPayload(
                result,
                requestId,
                opts.source,
                opts.bo_table,
                opts.wr_id,
                opts.latency_ms ?? 0
            )
        )
        .filter((event): event is AffiliateEventPayload => Boolean(event));

    if (events.length === 0) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
        await fetch(`${getAdsServerUrl()}/api/v1/serve/affiliate-events`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ events }),
            signal: controller.signal
        });
    } catch {
        // fail-open: affiliate 이벤트 적재 실패는 사용자 응답을 막지 않음
    } finally {
        clearTimeout(timeout);
    }
}

function buildDecisionEventType(
    decision: AffiliateDecision
): Extract<AffiliateEventType, 'success' | 'failure'> | null {
    if (decision.status === 'converted' && decision.network !== 'none') return 'success';
    if (decision.status === 'error' && decision.network !== 'none') return 'failure';
    return null;
}

function buildDecisionPayload(
    decision: AffiliateDecision,
    requestId: string,
    source: AffiliateSource,
    boardId?: string,
    postId?: number,
    commentId?: number,
    latencyMs = 0
): AffiliateEventPayload | null {
    const eventType = buildDecisionEventType(decision);
    if (!eventType || decision.network === 'none') return null;

    const entityType =
        source === 'post_body' || source === 'post_link1' || source === 'post_link2'
            ? 'post'
            : 'comment';
    const entityID =
        entityType === 'post' ? String(postId || 0) : commentId ? String(commentId) : '';
    const originalUrl = decision.originalUrl;
    const affiliateUrl = decision.affiliateUrl || '';

    return {
        event_type: eventType,
        platform: decision.network,
        merchant_domain: getMerchantDomain(decision.normalizedUrl || originalUrl),
        original_url: originalUrl,
        affiliate_url: affiliateUrl,
        board: boardId ?? '',
        post_id: postId ?? 0,
        source: 'stored_sync',
        entity_type: entityType,
        entity_id: entityID,
        request_id: requestId,
        dedupe_key: buildDedupeKey([
            eventType,
            source,
            boardId ?? '',
            String(postId ?? 0),
            String(commentId ?? 0),
            originalUrl,
            affiliateUrl
        ]),
        error_message: decision.reasonCode === 'converted' ? '' : decision.reasonCode,
        latency_ms: latencyMs
    };
}

export async function sendAffiliateDecisionEvents(
    decisions: Array<{
        decision: AffiliateDecision;
        source: AffiliateSource;
        boardId?: string;
        postId?: number;
        commentId?: number;
        latencyMs?: number;
    }>
): Promise<void> {
    const requestId = randomUUID();
    const events = decisions
        .map((entry) =>
            buildDecisionPayload(
                entry.decision,
                requestId,
                entry.source,
                entry.boardId,
                entry.postId,
                entry.commentId,
                entry.latencyMs ?? 0
            )
        )
        .filter((event): event is AffiliateEventPayload => Boolean(event));

    if (events.length === 0) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
        await fetch(`${getAdsServerUrl()}/api/v1/serve/affiliate-events`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ events }),
            signal: controller.signal
        });
    } catch {
        // fail-open
    } finally {
        clearTimeout(timeout);
    }
}

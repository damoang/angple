import type { AffiliateDecision, AffiliateNetwork, AffiliateReasonCode } from '../types';

const env = process.env;

/**
 * env 값 정제: 둘러싼 따옴표·공백 제거.
 * env 파일에 값이 따옴표째 저장되면 LP API가 "[-3] a_id 형식오류"로 전량 거부한다
 * (2026-07-10 전면 변환 실패 사고의 근본 원인).
 */
function sanitizeAffiliateId(raw: string | undefined): string {
    return (raw || '').trim().replace(/^['"]+|['"]+$/g, '');
}

export function getLinkPriceAffiliateId(): string {
    return sanitizeAffiliateId(env.AFFI_LINKPRICE_AFF_ID || env.AFFI_AFFILIATE_ID);
}

export function createLinkPriceFailureDecision(
    originalUrl: string,
    normalizedUrl: string,
    reasonCode: Extract<
        AffiliateReasonCode,
        | 'env_missing'
        | 'config_error'
        | 'merchant_denied'
        | 'api_error'
        | 'rebind_not_supported'
        | 'rebind_failed_upstream_blocked'
    >,
    upstreamError?: string
): AffiliateDecision {
    const network: AffiliateNetwork = 'linkprice';
    return {
        status: reasonCode === 'merchant_denied' ? 'denied' : 'error',
        reasonCode,
        network,
        originalUrl,
        normalizedUrl,
        ...(upstreamError ? { metadata: { upstreamError } } : {})
    };
}

/** LP 응답이 설정 오류(a_id 형식/미승인 계정 등)인지 — 머천트 거부와 구분해야 은폐되지 않는다. */
function isConfigError(upstreamError: string): boolean {
    return /\[-3\]|a_id/i.test(upstreamError);
}

export function classifyLinkPriceFailure(input: {
    originalUrl: string;
    normalizedUrl: string;
    upstreamError?: string;
}): AffiliateDecision {
    if (!getLinkPriceAffiliateId()) {
        return createLinkPriceFailureDecision(
            input.originalUrl,
            input.normalizedUrl,
            'env_missing'
        );
    }

    const upstream = input.upstreamError || '';

    if (isConfigError(upstream)) {
        return createLinkPriceFailureDecision(
            input.originalUrl,
            input.normalizedUrl,
            'config_error',
            upstream
        );
    }

    // 'Conversion failed' = 구 변환기 일반 실패, 'LinkPrice F: ...' = err_msg 전파형 거부
    if (upstream === 'Conversion failed' || upstream.startsWith('LinkPrice ')) {
        return createLinkPriceFailureDecision(
            input.originalUrl,
            input.normalizedUrl,
            'merchant_denied',
            upstream
        );
    }

    return createLinkPriceFailureDecision(
        input.originalUrl,
        input.normalizedUrl,
        'api_error',
        upstream || undefined
    );
}

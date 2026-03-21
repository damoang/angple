import type { AffiliateDecision, AffiliateDecisionStatus, AffiliateReasonCode } from './types';

export function createPassthroughDecision(
    originalUrl: string,
    normalizedUrl: string,
    reasonCode: AffiliateReasonCode = 'unknown'
): AffiliateDecision {
    const status: AffiliateDecisionStatus =
        reasonCode === 'unsupported_domain' ? 'unsupported' : 'passthrough';

    return {
        status,
        reasonCode,
        network: 'none',
        originalUrl,
        normalizedUrl
    };
}

export function createDeniedDecision(
    originalUrl: string,
    normalizedUrl: string,
    metadata?: AffiliateDecision['metadata']
): AffiliateDecision {
    return {
        status: 'denied',
        reasonCode: 'merchant_denied',
        network: 'none',
        originalUrl,
        normalizedUrl,
        metadata
    };
}

export function createErrorDecision(
    originalUrl: string,
    normalizedUrl: string,
    reasonCode: Extract<AffiliateReasonCode, 'env_missing' | 'api_error' | 'unknown'>,
    metadata?: AffiliateDecision['metadata']
): AffiliateDecision {
    return {
        status: 'error',
        reasonCode,
        network: 'none',
        originalUrl,
        normalizedUrl,
        metadata
    };
}

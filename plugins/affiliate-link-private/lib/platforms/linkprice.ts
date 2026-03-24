import type { AffiliateDecision, AffiliateNetwork, AffiliateReasonCode } from '../types';

const env = process.env;

export function getLinkPriceAffiliateId(): string {
    return env.AFFI_LINKPRICE_AFF_ID || env.AFFI_AFFILIATE_ID || '';
}

export function createLinkPriceFailureDecision(
    originalUrl: string,
    normalizedUrl: string,
    reasonCode: Extract<
        AffiliateReasonCode,
        | 'env_missing'
        | 'merchant_denied'
        | 'api_error'
        | 'rebind_not_supported'
        | 'rebind_failed_upstream_blocked'
    >
): AffiliateDecision {
    const network: AffiliateNetwork = 'linkprice';
    return {
        status: reasonCode === 'merchant_denied' ? 'denied' : 'error',
        reasonCode,
        network,
        originalUrl,
        normalizedUrl
    };
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

    if (input.upstreamError === 'Conversion failed') {
        return createLinkPriceFailureDecision(
            input.originalUrl,
            input.normalizedUrl,
            'merchant_denied'
        );
    }

    return createLinkPriceFailureDecision(input.originalUrl, input.normalizedUrl, 'api_error');
}

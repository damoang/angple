import type { AffiliateDecision } from '../types';

const env = process.env;

export function hasAliExpressCredentials(): boolean {
    return Boolean(env.AFFI_ALIEXPRESS_ACCESS_KEY && env.AFFI_ALIEXPRESS_SECRET_KEY);
}

export function createAliExpressEnvMissingDecision(
    originalUrl: string,
    normalizedUrl: string
): AffiliateDecision {
    return {
        status: 'error',
        reasonCode: 'env_missing',
        network: 'aliexpress',
        originalUrl,
        normalizedUrl
    };
}

export function createAliExpressApiErrorDecision(
    originalUrl: string,
    normalizedUrl: string,
    reasonCode: AffiliateDecision['reasonCode'] = 'api_error'
): AffiliateDecision {
    return {
        status: 'error',
        reasonCode,
        network: 'aliexpress',
        originalUrl,
        normalizedUrl
    };
}

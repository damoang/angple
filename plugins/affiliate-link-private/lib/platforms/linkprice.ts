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

/**
 * a_id 출처는 AFFI_AFFILIATE_ID **하나**다.
 *
 * 과거 `AFFI_LINKPRICE_AFF_ID || AFFI_AFFILIATE_ID` 폴백을 뒀다가, 우선순위가 높은 쪽에
 * 미승인 ID가 들어가 승인된 값을 **조용히 가리는** 사고가 두 번 났다(2026-03·07). 값이 틀린 게
 * 아니라 "가릴 수 있는 두 번째 변수가 존재하는 것" 자체가 사고 기계이므로 변수를 하나로 고정한다.
 * 크리덴셜에 폴백을 다시 추가하지 말 것.
 */
export function getLinkPriceAffiliateId(): string {
    return sanitizeAffiliateId(env.AFFI_AFFILIATE_ID);
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

/**
 * LP 응답이 설정 오류(a_id 형식/미승인 계정 등)인지 — 머천트 거부와 구분해야 은폐되지 않는다.
 *
 * 계정(a_id) 단위 실패 코드:
 *   [-3] a_id 형식오류 (값에 따옴표 등)        — 2026-07-10 사고
 *   [-6] 승인거부 (해당 a_id 가 미승인 계정)   — 2026-03·07-16 사고. 이 코드가 분류에서 빠져
 *        있어 merchant_denied 로 위장됐고, 설정오류 경보가 3일간 발화하지 않았다.
 * 두 코드 모두 "우리 계정 문제"라 개별 머천트 거부와 달리 즉시 사람이 개입해야 한다.
 */
function isConfigError(upstreamError: string): boolean {
    return /\[-3\]|\[-6\]|a_id/i.test(upstreamError);
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

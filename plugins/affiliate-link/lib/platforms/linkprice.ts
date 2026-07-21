/**
 * 링크프라이스 제휴 링크 변환기
 * REST API 호출 (150+ 쇼핑몰 지원)
 */

import type { PlatformConverter, ConvertContext } from '../types';
import {
    PLATFORM_DOMAINS,
    matchesPlatform,
    LINKPRICE_MERCHANTS,
    extractHost
} from '../domain-matcher';
const env = process.env;

const API_ENDPOINT = 'https://api.linkprice.com/ci/service/custom_link_xml';
const API_TIMEOUT_MS = 2_500;

/**
 * 클릭 ID 생성 (추적용)
 * 형식: u{mb_no}_{bo_table}_{wr_id} 또는 {bo_table}_{wr_id}
 */
function generateClickId(context?: ConvertContext): string {
    const parts: string[] = [];

    if (context?.mb_no) {
        parts.push(`u${context.mb_no}`);
    }

    if (context?.bo_table) {
        parts.push(context.bo_table);
    }

    if (context?.wr_id) {
        parts.push(String(context.wr_id));
    }

    return parts.join('_') || 'direct';
}

/**
 * env 값 정제: 둘러싼 따옴표·공백 제거.
 * env 파일에 값이 따옴표째 저장되면 LP API가 "[-3] a_id 형식오류"로 전량 거부한다
 * (2026-07-10 전면 변환 실패 사고의 근본 원인).
 */
export function sanitizeLinkPriceAffiliateId(raw: string | undefined): string {
    const cleaned = (raw || '').trim().replace(/^['"]+|['"]+$/g, '');
    if (cleaned && !/^A\d+$/.test(cleaned)) {
        console.warn(
            '[LinkPrice] a_id 형식 경고 (A+숫자 아님):',
            cleaned.replace(/[A-Za-z0-9]/g, 'x')
        );
    }
    return cleaned;
}

/**
 * 링크프라이스 API 호출
 */
async function callLinkPriceApi(
    originalUrl: string,
    context?: ConvertContext
): Promise<string | null> {
    const affiliateId = sanitizeLinkPriceAffiliateId(env.AFFI_AFFILIATE_ID);

    if (!affiliateId) {
        console.warn('[LinkPrice] Affiliate ID가 설정되지 않음');
        return null;
    }

    const clickId = generateClickId(context);
    const encodedUrl = encodeURIComponent(originalUrl);

    const apiUrl = `${API_ENDPOINT}?a_id=${affiliateId}&url=${encodedUrl}&u_id=${clickId}&mode=json`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DamoangBot/1.0)'
            }
        });

        if (!response.ok) {
            console.error(`[LinkPrice] API 오류: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // 응답 구조: { result: 'S', url: '변환된 URL' }
        if (data.result === 'S' && data.url) {
            let linkpriceUrl = data.url;

            // u_id가 없으면 수동 추가
            if (!linkpriceUrl.includes('&u=') && !linkpriceUrl.includes('?u=')) {
                const separator = linkpriceUrl.includes('?') ? '&' : '?';
                linkpriceUrl += `${separator}u=${encodeURIComponent(clickId)}`;
            }

            return linkpriceUrl;
        }

        // 변환 거부 — 사유(err_msg)를 상위로 전파해 last_error 에 남긴다.
        // "[-3] a_id 형식오류" 같은 설정 오류가 일반 거부로 위장되는 것을 방지 (2026-07-10 사고).
        const upstreamMsg = data?.err_msg || data?.message || data?.msg || '';
        if (isLinkPriceMerchant(originalUrl)) {
            console.warn('[LinkPrice] conversion miss', {
                originalUrl,
                clickId,
                result: data?.result,
                message: upstreamMsg || null
            });
        }
        const missError = new Error(
            `LinkPrice ${data?.result ?? 'F'}${upstreamMsg ? `: ${upstreamMsg}` : ''}`
        );
        missError.name = 'LinkPriceConversionError';
        throw missError;
    } catch (error) {
        if (error instanceof Error && error.name === 'LinkPriceConversionError') {
            throw error;
        }
        if (error instanceof Error && error.name === 'TimeoutError') {
            console.warn('[LinkPrice] API timeout', {
                originalUrl,
                clickId,
                timeoutMs: API_TIMEOUT_MS
            });
            return null;
        }
        console.error('[LinkPrice] API 호출 실패:', error);
        return null;
    }
}

/**
 * URL이 링크프라이스 머천트인지 확인
 */
function isLinkPriceMerchant(url: string): boolean {
    // 이미 링크프라이스 단축 URL인 경우
    if (matchesPlatform(url, 'linkprice')) {
        return true;
    }

    // 머천트 도메인 확인
    const host = extractHost(url);
    if (!host) return false;

    for (const merchant of LINKPRICE_MERCHANTS) {
        if (host === merchant || host.endsWith('.' + merchant)) {
            return true;
        }
    }

    return false;
}

export const linkpriceConverter: PlatformConverter = {
    platform: 'linkprice',
    info: PLATFORM_DOMAINS.linkprice,

    matches(url: string): boolean {
        return isLinkPriceMerchant(url);
    },

    async convert(url: string, context?: ConvertContext): Promise<string | null> {
        return callLinkPriceApi(url, context);
    }
};

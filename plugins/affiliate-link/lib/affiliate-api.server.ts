/**
 * 제휴 링크 변환 메인 API
 */

import type { AffiliatePlatform, ConvertContext, ConvertResponse, BatchConvertResponse } from './types';
import { detectPlatform, isAffiliateUrl, getPlatformNameKo, normalizeUrl } from './domain-matcher';
import { findConverter } from './platforms/index';
import { getFromCache, setSuccessCache, setErrorCache } from './cache.server';
import { buildAffiliateRedirectUrl } from '$lib/server/affiliate-redirect';

const inFlightConversions = new Map<string, Promise<ConvertResponse>>();

function getInFlightKey(url: string, context?: ConvertContext): string {
    return `${url}:${context?.bo_table || ''}:${context?.wr_id || ''}:${context?.mb_no || ''}`;
}

/**
 * 단일 URL 변환
 */
export async function convertAffiliateUrl(
    url: string,
    context?: ConvertContext
): Promise<ConvertResponse> {
    const inFlightKey = getInFlightKey(url, context);
    const inFlight = inFlightConversions.get(inFlightKey);
    if (inFlight) {
        return inFlight;
    }

    const conversionPromise = convertAffiliateUrlInternal(url, context).finally(() => {
        inFlightConversions.delete(inFlightKey);
    });

    inFlightConversions.set(inFlightKey, conversionPromise);
    return conversionPromise;
}

async function convertAffiliateUrlInternal(
    url: string,
    context?: ConvertContext
): Promise<ConvertResponse> {
    const original = url;
    const candidate = normalizeUrl(url) ?? url;

    // 1. 제휴 대상 URL인지 확인
    const platform = detectPlatform(candidate);
    if (!platform) {
        return {
            url: original,
            original,
            platform: null,
            converted: false,
            cached: false
        };
    }

    // 2. 캐시 확인
    const cached = getFromCache(candidate, context?.bo_table, context?.wr_id);
    if (cached === 'error') {
        console.warn('[AffiliateAPI] cached error hit', {
            url: candidate,
            platform,
            bo_table: context?.bo_table,
            wr_id: context?.wr_id
        });
        return {
            url: original,
            original,
            platform,
            converted: false,
            cached: true,
            error: 'Previously failed'
        };
    }
    if (cached) {
        return {
            url: cached.url,
            original,
            platform: cached.platform,
            converted: true,
            cached: true
        };
    }

    // 3. 변환기 찾기
    const converter = findConverter(candidate);
    if (!converter) {
        return {
            url: original,
            original,
            platform,
            converted: false,
            cached: false,
            error: 'No converter found'
        };
    }

    // 4. 변환 시도
    try {
        const convertedUrl = await converter.convert(candidate, context);

        if (convertedUrl) {
            // 성공 - 캐시 저장
            setSuccessCache(candidate, convertedUrl, platform, context?.bo_table, context?.wr_id);
            return {
                url: convertedUrl,
                original,
                platform,
                converted: true,
                cached: false
            };
        } else {
            // 실패 - 에러 캐시 저장
            setErrorCache(candidate, context?.bo_table, context?.wr_id);
            console.warn('[AffiliateAPI] conversion failed', {
                url: candidate,
                platform,
                bo_table: context?.bo_table,
                wr_id: context?.wr_id
            });
            return {
                url: original,
                original,
                platform,
                converted: false,
                cached: false,
                error: 'Conversion failed'
            };
        }
    } catch (error) {
        console.error(`[AffiliateAPI] 변환 오류 (${platform}):`, error);
        setErrorCache(candidate, context?.bo_table, context?.wr_id);
        return {
            url: original,
            original,
            platform,
            converted: false,
            cached: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * 여러 URL 일괄 변환
 */
export async function convertAffiliateUrls(
    urls: string[],
    context?: ConvertContext
): Promise<BatchConvertResponse> {
    const results: ConvertResponse[] = [];
    let converted = 0;
    let cached = 0;
    let failed = 0;

    // 병렬 처리 (최대 5개씩)
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((url) => convertAffiliateUrl(url, context)));

        for (const result of batchResults) {
            results.push(result);
            if (result.converted) {
                converted++;
                if (result.cached) cached++;
            } else if (result.error) {
                failed++;
            }
        }
    }

    return {
        results,
        stats: {
            total: urls.length,
            converted,
            cached,
            failed
        }
    };
}

/**
 * HTML 콘텐츠 내 링크 변환
 */
export async function convertAffiliateLinks(
    content: string,
    boTable?: string,
    wrId?: number
): Promise<string> {
    const { content: convertedContent } = await convertAffiliateLinksDetailed(content, boTable, wrId);
    return convertedContent;
}

/**
 * HTML 콘텐츠 내 링크 변환 + 결과 반환
 */
export async function convertAffiliateLinksDetailed(
    content: string,
    boTable?: string,
    wrId?: number
): Promise<{ content: string; results: ConvertResponse[] }> {
    if (!content) return { content, results: [] };

    // <a> 태그에서 URL 추출
    const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
    const matches: Array<{
        full: string;
        beforeHref: string;
        url: string;
        afterHref: string;
        innerHtml: string;
    }> =
        [];

    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        matches.push({
            full: match[0],
            beforeHref: match[1],
            url: match[2],
            afterHref: match[3],
            innerHtml: match[4]
        });
    }

    if (matches.length === 0) return { content, results: [] };

    // 제휴 대상 URL 필터링
    const affiliateMatches = matches.filter((m) => isAffiliateUrl(m.url));

    if (affiliateMatches.length === 0) return { content, results: [] };

    // 일괄 변환
    const context: ConvertContext = { bo_table: boTable, wr_id: wrId };
    const urls = affiliateMatches.map((m) => m.url);
    const { results } = await convertAffiliateUrls(urls, context);

    // URL 매핑
    const urlMap = new Map<string, ConvertResponse>();
    for (let i = 0; i < urls.length; i++) {
        urlMap.set(urls[i], results[i]);
    }

    // 콘텐츠 내 링크 교체
    let newContent = content;
    for (const m of affiliateMatches) {
        const result = urlMap.get(m.url);
        if (!result || !result.converted || !result.platform) continue;

        // 제휴 배지 생성
        const platformName = getPlatformNameKo(result.platform);
        const badge = `<span class="affiliate-badge" title="${platformName} 제휴 링크">💰</span>`;

        // /go 리다이렉트 URL 생성 (클릭 로깅 + 감사 추적)
        const goUrl = await buildAffiliateRedirectUrl({
            url: result.url,
            platform: result.platform,
            ...(boTable ? { board: boTable } : {}),
            ...(wrId ? { postId: wrId } : {})
        });

        // 기존 rel 속성 제거 후 sponsored 포함 재설정
        const cleanedBefore = m.beforeHref.replace(/\s*rel="[^"]*"/gi, '');
        const cleanedAfter = m.afterHref.replace(/\s*rel="[^"]*"/gi, '');

        // 새 링크 생성 (rel="nofollow noopener sponsored" + /go 리다이렉트)
        const newLink = `<a ${cleanedBefore}href="${goUrl}" data-affiliate="${result.platform}" rel="nofollow noopener sponsored"${cleanedAfter}>${m.innerHtml}${badge}</a>`;

        newContent = newContent.replace(m.full, newLink);
    }

    return { content: newContent, results };
}

/**
 * 플랫폼 정보 가져오기
 */
export function getAffiliatePlatformInfo(platform: AffiliatePlatform): { name: string; nameKo: string } {
    return {
        name: platform,
        nameKo: getPlatformNameKo(platform)
    };
}

export { detectPlatform, isAffiliateUrl, getPlatformNameKo };

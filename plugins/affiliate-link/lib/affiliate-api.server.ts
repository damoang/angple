/**
 * 제휴 링크 변환 메인 API (서버사이드)
 *
 * - 플랫폼 변환기를 직접 호출 (HTTP 없이)
 * - Redis TieredCache 2-tier 캐시 사용
 * - API 라우트 + 서버사이드 콘텐츠 변환 양쪽에서 공유
 * - DB 기반 동적 머천트 로딩 (ads 서버 연동)
 * - ClickHouse 이벤트 추적 (fire-and-forget)
 */

import type { ConvertContext, ConvertResponse, BatchConvertResponse } from './types';
import type { AffiliateEvent } from './types';
import {
	detectPlatform,
	detectPlatformAsync,
	isAffiliateUrl,
	isAffiliateUrlAsync,
	getPlatformNameKo,
	setDynamicMerchantLoader,
	extractHost
} from './domain-matcher';
import { findConverter } from './platforms/index';
import { getFromCache, setSuccessCache, setErrorCache } from './cache.server';
import { getPlatformMerchants } from '$lib/server/affiliate-merchants.js';
import { sendAffiliateEvents } from '$lib/server/affiliate-events.js';

// 서버 시작 시 동적 머천트 로더 주입
setDynamicMerchantLoader(getPlatformMerchants);

/**
 * 단일 URL 변환
 */
export async function convertAffiliateUrl(
	url: string,
	context?: ConvertContext
): Promise<ConvertResponse> {
	const original = url;
	const startTime = Date.now();

	// 1. 제휴 대상 URL인지 확인 (비동기 — DB 기반 동적 로딩)
	const platform = await detectPlatformAsync(url);
	if (!platform) {
		return {
			url: original,
			original,
			platform: null,
			converted: false,
			cached: false
		};
	}

	// 2. 캐시 확인 (async — Redis TieredCache)
	const cached = await getFromCache(url);
	if (cached === 'error') {
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
	const converter = findConverter(url);
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
		const convertedUrl = await converter.convert(url, context);
		const latencyMs = Date.now() - startTime;

		if (convertedUrl) {
			await setSuccessCache(url, convertedUrl, platform);
			return {
				url: convertedUrl,
				original,
				platform,
				converted: true,
				cached: false,
				latencyMs
			};
		} else {
			await setErrorCache(url);
			return {
				url: original,
				original,
				platform,
				converted: false,
				cached: false,
				error: 'Conversion failed',
				latencyMs
			};
		}
	} catch (error) {
		const latencyMs = Date.now() - startTime;
		console.error(`[AffiliateAPI] 변환 오류 (${platform}):`, error);
		await setErrorCache(url);
		return {
			url: original,
			original,
			platform,
			converted: false,
			cached: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			latencyMs
		};
	}
}

/**
 * 여러 URL 일괄 변환 (5개씩 병렬)
 */
export async function convertAffiliateUrls(
	urls: string[],
	context?: ConvertContext
): Promise<BatchConvertResponse> {
	const results: ConvertResponse[] = [];
	let converted = 0;
	let cached = 0;
	let failed = 0;

	const batchSize = 5;
	for (let i = 0; i < urls.length; i += batchSize) {
		const batch = urls.slice(i, i + batchSize);
		const batchResults = await Promise.all(
			batch.map((url) => convertAffiliateUrl(url, context))
		);

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
 * HTML 콘텐츠 내 <a> 태그의 href를 수익링크로 변환
 * (서버사이드 콘텐츠 변환의 핵심 함수)
 */
export async function convertAffiliateLinks(
	content: string,
	boTable?: string,
	wrId?: number
): Promise<string> {
	if (!content) return content;

	// <a> 태그에서 URL 추출
	const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
	const matches: Array<{
		full: string;
		beforeHref: string;
		url: string;
		afterHref: string;
		text: string;
	}> = [];

	let match;
	while ((match = linkRegex.exec(content)) !== null) {
		matches.push({
			full: match[0],
			beforeHref: match[1],
			url: match[2],
			afterHref: match[3],
			text: match[4]
		});
	}

	if (matches.length === 0) return content;

	// 제휴 대상 URL 필터링 (비동기 — DB 기반 동적 로딩)
	const affiliateChecks = await Promise.all(
		matches.map(async (m) => ({ match: m, isAffiliate: await isAffiliateUrlAsync(m.url) }))
	);
	const affiliateMatches = affiliateChecks.filter((c) => c.isAffiliate).map((c) => c.match);
	if (affiliateMatches.length === 0) return content;

	// URL 중복 제거 후 일괄 변환
	const uniqueUrls = [...new Set(affiliateMatches.map((m) => m.url))];
	const context: ConvertContext = { bo_table: boTable, wr_id: wrId };
	const { results } = await convertAffiliateUrls(uniqueUrls, context);

	// URL → 변환 결과 맵
	const urlMap = new Map<string, ConvertResponse>();
	for (let i = 0; i < uniqueUrls.length; i++) {
		urlMap.set(uniqueUrls[i], results[i]);
	}

	// 콘텐츠 내 링크 교체 (href만 교체, 배지 추가하지 않음 — 클라이언트 DOMPurify가 제거할 수 있음)
	let newContent = content;
	for (const m of affiliateMatches) {
		const result = urlMap.get(m.url);
		if (!result || !result.converted || !result.platform) continue;

		// href만 교체 + data-affiliate 속성 추가
		const newLink = `<a ${m.beforeHref}href="${result.url}" data-affiliate="${result.platform}"${m.afterHref}>${m.text}</a>`;
		newContent = newContent.replace(m.full, newLink);
	}

	// 통계 이벤트 수집 및 전송 (fire-and-forget)
	const events: AffiliateEvent[] = [];
	for (const result of results) {
		if (!result.platform) continue;
		const host = extractHost(result.original);
		if (result.cached && result.converted) {
			events.push({
				event_type: 'cache_hit',
				platform: result.platform,
				merchant_domain: host || '',
				original_url: result.original,
				affiliate_url: result.url,
				board: boTable || '',
				post_id: wrId || 0,
				latency_ms: result.latencyMs || 0
			});
		} else if (result.converted) {
			events.push({
				event_type: 'success',
				platform: result.platform,
				merchant_domain: host || '',
				original_url: result.original,
				affiliate_url: result.url,
				board: boTable || '',
				post_id: wrId || 0,
				latency_ms: result.latencyMs || 0
			});
		} else if (result.error) {
			events.push({
				event_type: 'failure',
				platform: result.platform,
				merchant_domain: host || '',
				original_url: result.original,
				board: boTable || '',
				post_id: wrId || 0,
				error_message: result.error,
				latency_ms: result.latencyMs || 0
			});
		}
	}

	if (events.length > 0) {
		// fire-and-forget: 통계 전송 실패해도 변환은 정상 반환
		sendAffiliateEvents(events).catch(() => {});
	}

	return newContent;
}

export { detectPlatform, detectPlatformAsync, isAffiliateUrl, isAffiliateUrlAsync, getPlatformNameKo };

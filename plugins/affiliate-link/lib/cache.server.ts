/**
 * 제휴 링크 캐싱 로직
 * Redis 2-tier 캐시 (L1 메모리 + L2 Redis)
 *
 * - 같은 URL은 bo_table/wr_id 무관하게 같은 수익링크 → 키에 URL만 사용
 * - 성공 TTL: 7일, 에러 TTL: 6시간
 */

import { createHash } from 'crypto';
import { TieredCache } from '$lib/server/cache.js';
import type { AffiliatePlatform } from './types';

/** 캐시 저장 데이터 */
interface AffiliateCacheData {
	url: string;
	platform: AffiliatePlatform;
}

/** 에러 센티널 */
interface AffiliateErrorData {
	isError: true;
}

type CacheValue = AffiliateCacheData | AffiliateErrorData;

// TTL 설정
const SUCCESS_L1_TTL_MS = 10 * 60 * 1000; // L1: 10분
const SUCCESS_L2_TTL_SEC = 7 * 24 * 60 * 60; // L2: 7일
const ERROR_L1_TTL_MS = 5 * 60 * 1000; // L1: 5분
const ERROR_L2_TTL_SEC = 6 * 60 * 60; // L2: 6시간

// 성공 캐시
const successCache = new TieredCache<AffiliateCacheData>(
	'affi',
	SUCCESS_L1_TTL_MS,
	SUCCESS_L2_TTL_SEC,
	10000
);

// 에러 캐시 (짧은 TTL)
const errorCache = new TieredCache<AffiliateErrorData>(
	'affi_err',
	ERROR_L1_TTL_MS,
	ERROR_L2_TTL_SEC,
	5000
);

/**
 * 캐시 키 생성 — URL만 기준 (같은 URL → 같은 수익링크)
 */
function getCacheKey(url: string): string {
	return createHash('md5').update(url).digest('hex');
}

/**
 * 캐시에서 조회
 */
export async function getFromCache(
	url: string
): Promise<{ url: string; platform: AffiliatePlatform } | 'error' | null> {
	const key = getCacheKey(url);

	// 성공 캐시 확인
	const cached = await successCache.get(key);
	if (cached) {
		return { url: cached.url, platform: cached.platform };
	}

	// 에러 캐시 확인
	const errCached = await errorCache.get(key);
	if (errCached) {
		return 'error';
	}

	return null;
}

/**
 * 성공 결과 캐시 저장
 */
export async function setSuccessCache(
	originalUrl: string,
	convertedUrl: string,
	platform: AffiliatePlatform
): Promise<void> {
	const key = getCacheKey(originalUrl);
	await successCache.set(key, { url: convertedUrl, platform });
	// 에러 캐시 제거 (이전 에러가 있었다면)
	await errorCache.delete(key);
}

/**
 * 에러 캐시 저장
 */
export async function setErrorCache(url: string): Promise<void> {
	const key = getCacheKey(url);
	await errorCache.set(key, { isError: true });
}

/**
 * 캐시 초기화 (L1만)
 */
export function clearCache(): void {
	successCache.clearL1();
	errorCache.clearL1();
}

/**
 * 제휴 링크 머천트 동적 로더
 *
 * ads 서버의 GET /api/v1/serve/affiliate-merchants 를 호출하여
 * 플랫폼별 머천트 도메인 목록을 가져옵니다.
 *
 * - TieredCache로 캐싱 (L1: 5분, L2 Redis: 1시간)
 * - API 실패 시 하드코딩 fallback 사용
 * - 머천트 추가/삭제 시 코드 배포 없이 5분 이내 반영
 */

import { TieredCache } from './cache.js';
import { getAdsServerUrl } from './ads/config.js';

/** 플랫폼별 도메인 목록 */
export interface MerchantDomains {
    platforms: Record<string, string[]>;
    updatedAt: string;
}

// 캐시: L1 5분, L2 1시간
const merchantCache = new TieredCache<MerchantDomains>(
    'affi_merchants',
    5 * 60 * 1000, // L1: 5분
    60 * 60, // L2: 1시간
    1 // 항목 1개 (전체 머천트 목록)
);

const CACHE_KEY = 'domains';

/**
 * ads 서버에서 머천트 도메인 목록 가져오기
 */
async function fetchFromAdsServer(): Promise<MerchantDomains | null> {
    try {
        const url = `${getAdsServerUrl()}/api/v1/serve/affiliate-merchants`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(3_000)
        });

        if (!res.ok) {
            console.warn(`[AffiliateMerchants] ads 서버 응답 오류: ${res.status}`);
            return null;
        }

        const json = await res.json();
        if (!json.success || !json.data?.platforms) {
            console.warn('[AffiliateMerchants] 잘못된 응답 형식');
            return null;
        }

        return {
            platforms: json.data.platforms,
            updatedAt: json.data.updatedAt || new Date().toISOString()
        };
    } catch (error) {
        console.warn('[AffiliateMerchants] ads 서버 호출 실패:', error);
        return null;
    }
}

/**
 * 플랫폼별 머천트 도메인 목록 조회 (캐시 우선)
 *
 * @returns platforms map 또는 API 실패 시 null (caller가 fallback 처리)
 */
export async function getMerchantDomains(): Promise<MerchantDomains | null> {
    return merchantCache
        .getOrFetch(CACHE_KEY, async () => {
            const data = await fetchFromAdsServer();
            if (!data) {
                // factory에서 null 반환 불가 (getOrFetch가 캐시에 저장함)
                // 대신 빈 구조 반환 → caller에서 fallback 판단
                throw new Error('API fetch failed');
            }
            return data;
        })
        .catch(() => null);
}

/**
 * 특정 플랫폼의 머천트 도메인 배열 조회
 *
 * @returns 도메인 배열 또는 API 실패 시 null
 */
export async function getPlatformMerchants(platform: string): Promise<string[] | null> {
    const data = await getMerchantDomains();
    if (!data) return null;
    return data.platforms[platform] || [];
}

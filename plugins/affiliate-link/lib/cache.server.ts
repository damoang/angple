/**
 * 제휴 링크 캐싱 로직
 * Redis 또는 메모리 캐시 지원
 */

import { createHash } from 'crypto';
import type { AffiliatePlatform } from './types';

/** 캐시 항목 */
interface CacheItem {
    url: string;
    platform: AffiliatePlatform;
    timestamp: number;
}

/** 에러 캐시 항목 */
interface ErrorCacheItem {
    isError: true;
    timestamp: number;
}

type CacheValue = CacheItem | ErrorCacheItem;

// 메모리 캐시 (서버 재시작 시 초기화)
const memoryCache = new Map<string, CacheValue>();

// 캐시 TTL (초)
const TTL = {
    SUCCESS: 7 * 24 * 60 * 60, // 7일 (성공)
    PERMANENT_ERROR: 24 * 60 * 60, // 24시간 (지원 불가 도메인)
    TEMPORARY_ERROR: 6 * 60 * 60 // 6시간 (API 오류)
};

/**
 * 캐시 키 생성
 */
function getCacheKey(url: string, boTable?: string, wrId?: number): string {
    const input = `${url}:${boTable || ''}:${wrId || ''}`;
    return `affiliate:${createHash('md5').update(input).digest('hex')}`;
}

/**
 * 캐시에서 조회
 */
export function getFromCache(
    url: string,
    boTable?: string,
    wrId?: number
): { url: string; platform: AffiliatePlatform } | 'error' | null {
    const key = getCacheKey(url, boTable, wrId);
    const cached = memoryCache.get(key);

    if (!cached) {
        return null;
    }

    // TTL 확인
    const now = Date.now();
    const age = (now - cached.timestamp) / 1000;

    if ('isError' in cached) {
        // 에러 캐시
        if (age > TTL.TEMPORARY_ERROR) {
            memoryCache.delete(key);
            return null;
        }
        return 'error';
    }

    // 성공 캐시
    if (age > TTL.SUCCESS) {
        memoryCache.delete(key);
        return null;
    }

    return { url: cached.url, platform: cached.platform };
}

/**
 * 성공 결과 캐시 저장
 */
export function setSuccessCache(
    originalUrl: string,
    convertedUrl: string,
    platform: AffiliatePlatform,
    boTable?: string,
    wrId?: number
): void {
    const key = getCacheKey(originalUrl, boTable, wrId);
    memoryCache.set(key, {
        url: convertedUrl,
        platform,
        timestamp: Date.now()
    });
}

/**
 * 에러 캐시 저장
 */
export function setErrorCache(url: string, boTable?: string, wrId?: number): void {
    const key = getCacheKey(url, boTable, wrId);
    memoryCache.set(key, {
        isError: true,
        timestamp: Date.now()
    });
}

/**
 * 캐시 통계
 */
export function getCacheStats(): { size: number; keys: string[] } {
    return {
        size: memoryCache.size,
        keys: Array.from(memoryCache.keys())
    };
}

/**
 * 캐시 초기화
 */
export function clearCache(): void {
    memoryCache.clear();
}

/**
 * 만료된 캐시 정리
 */
export function cleanupExpiredCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of memoryCache.entries()) {
        const age = (now - value.timestamp) / 1000;
        const ttl = 'isError' in value ? TTL.TEMPORARY_ERROR : TTL.SUCCESS;

        if (age > ttl) {
            memoryCache.delete(key);
            cleaned++;
        }
    }

    return cleaned;
}

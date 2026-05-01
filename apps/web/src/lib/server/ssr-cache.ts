/**
 * SSR 응답 캐시 (비로그인 사용자 전용)
 *
 * hooks.server.ts에서 사용하며, 글 작성/수정/삭제 시
 * 해당 게시판 캐시를 무효화하기 위해 별도 모듈로 분리.
 *
 * ## Memory optimization (2026-04-24 postmortem)
 * Body를 gzip 압축해서 Map에 저장 — pod heap 절감.
 * HTML 40-60KB → gzip 7-12KB (약 80% 감소).
 * CPU 비용: compress 1-2ms, decompress 0.5ms (v8 native gzip).
 * MAX 500 entries × 45KB = 22MB → 7MB (15MB 절감).
 */

import { gzipSync, gunzipSync } from 'zlib';

/** 키: pathname → { body(gzip 압축), timestamp } */
export const ssrCache = new Map<string, { body: Uint8Array; timestamp: number }>();

/** Singleflight 중복 요청 방지용 */
export const ssrCachePending = new Map<string, Promise<Response>>();

// 4/30 누수 분석 후속 (단계 2): TTL 통일 30s + cap 500→200 + 자동 cleanup (LRU + lazy expire).
// 기존 hooks.server.ts 의 cap 강제와 별개로 ssr-cache.ts 자체에서 정리 — defense-in-depth.
export const SSR_CACHE_TTL_HOME = 30_000; // 홈 60→30초 (단계 2)
export const SSR_CACHE_TTL_BOARD = 30_000; // 게시판 목록 30초
export const SSR_CACHE_TTL_POST = 30_000; // 글 상세 60→30초 (단계 2)
export const MAX_SSR_CACHE_SIZE = 200; // 500→200 (단계 2, fire 분석 후 미세조정)
const SSR_CACHE_TTL_MAX = 30_000; // cleanup 기준 (모든 path TTL 통일)
const SSR_CACHE_CLEANUP_INTERVAL = 10_000; // 10s 자동 sweep

// 자동 sweep — TTL 만료 entry + cap 초과 시 oldest (Map insertion order = LRU) 제거
const ssrCacheCleanupTimer = setInterval(() => {
    const now = Date.now();
    // 1. TTL 만료 entry 제거 (lazy expire)
    for (const [key, entry] of ssrCache) {
        if (now - entry.timestamp > SSR_CACHE_TTL_MAX) {
            ssrCache.delete(key);
        }
    }
    // 2. cap 초과 시 oldest 제거 (LRU)
    while (ssrCache.size > MAX_SSR_CACHE_SIZE) {
        const oldestKey = ssrCache.keys().next().value;
        if (oldestKey === undefined) break;
        ssrCache.delete(oldestKey);
    }
}, SSR_CACHE_CLEANUP_INTERVAL);
ssrCacheCleanupTimer.unref?.();

/** HTML string → gzip compressed bytes (저장용) */
export function compressSsrBody(html: string): Uint8Array {
    return gzipSync(html, { level: 6 });
}

/** gzip compressed bytes → HTML string (조회용) */
export function decompressSsrBody(compressed: Uint8Array): string {
    return gunzipSync(compressed).toString('utf-8');
}

/**
 * 게시판 관련 캐시 무효화
 * 글 작성/수정/삭제 시 호출하여 해당 게시판 목록 + 홈 캐시를 즉시 제거
 */
export function invalidateBoardCache(boardId: string, postId?: number): void {
    // 게시판 목록 캐시 제거
    ssrCache.delete(`/${boardId}`);
    // 홈 캐시 제거 (새 글이 홈에도 표시되므로)
    ssrCache.delete('/');
    // 글 상세 캐시 제거
    if (postId) {
        ssrCache.delete(`/${boardId}/${postId}`);
    }
}

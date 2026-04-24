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

export const SSR_CACHE_TTL_HOME = 60_000; // 홈 60초
export const SSR_CACHE_TTL_BOARD = 30_000; // 게시판 목록 30초 (120초 → 30초 단축)
export const SSR_CACHE_TTL_POST = 60_000; // 글 상세 60초
export const MAX_SSR_CACHE_SIZE = 500;

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

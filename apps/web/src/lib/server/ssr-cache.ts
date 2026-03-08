/**
 * SSR 응답 캐시 (비로그인 사용자 전용)
 *
 * hooks.server.ts에서 사용하며, 글 작성/수정/삭제 시
 * 해당 게시판 캐시를 무효화하기 위해 별도 모듈로 분리.
 */

/** 키: pathname → { body, timestamp } */
export const ssrCache = new Map<string, { body: string; timestamp: number }>();

/** Singleflight 중복 요청 방지용 */
export const ssrCachePending = new Map<string, Promise<Response>>();

export const SSR_CACHE_TTL_HOME = 60_000; // 홈 60초
export const SSR_CACHE_TTL_BOARD = 30_000; // 게시판 목록 30초 (120초 → 30초 단축)
export const SSR_CACHE_TTL_POST = 60_000; // 글 상세 60초
export const MAX_SSR_CACHE_SIZE = 500;

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

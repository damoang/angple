/**
 * 인메모리 조회수 캐시 (PHP ViewCountCache 패턴 이식)
 *
 * PHP(그누보드)의 Redis 기반 조회수 캐시와 동일한 패턴:
 * - 글 조회 시 인메모리 Map에 카운트 누적
 * - 3분마다 cron이 /api/viewcount/sync 호출 → MySQL 일괄 동기화
 * - Node.js 싱글스레드이므로 Map 조작에 동시성 문제 없음
 * - 서버 재시작 시 미동기화 카운트 유실 가능 (3분 이내 분량, 허용)
 */

/** 키: `{boardId}:{postId}` → 누적 조회수 */
const viewCounts = new Map<string, number>();

/** 조회수 1 증가 */
export function increment(boardId: string, postId: number): void {
    const key = `${boardId}:${postId}`;
    viewCounts.set(key, (viewCounts.get(key) || 0) + 1);
}

/** 모든 카운트를 스냅샷으로 반환하고 Map 초기화 */
export function flushAll(): Map<string, number> {
    const snapshot = new Map(viewCounts);
    viewCounts.clear();
    return snapshot;
}

/** 현재 캐시된 항목 수 */
export function size(): number {
    return viewCounts.size;
}

/**
 * 인메모리 조회수 캐시 (PHP ViewCountCache 패턴 이식)
 *
 * PHP(그누보드)의 Redis 기반 조회수 캐시와 동일한 패턴:
 * - 글 조회 시 인메모리 Map에 카운트 누적
 * - 3분마다 cron이 /api/viewcount/sync 호출 → MySQL 일괄 동기화
 * - Node.js 싱글스레드이므로 Map 조작에 동시성 문제 없음
 * - 서버 재시작 시 미동기화 카운트 유실 가능 (3분 이내 분량, 허용)
 *
 * IP 중복 방지: Redis 기반 (pod 간 공유 — HPA 환경에서 필수)
 */

import { getRedis } from './redis';

/** 키: `{boardId}:{postId}` → 누적 조회수 */
const viewCounts = new Map<string, number>();

/** Redis 키 접두사 */
const VIEWED_PREFIX = 'vc:';
const VIEWED_TTL_SEC = 600; // 10분

/** IP 기반으로 최근 10분 이내 조회했는지 확인 (Redis — pod 간 공유) */
export async function hasRecentlyViewed(
    ip: string,
    boardId: string,
    postId: number
): Promise<boolean> {
    try {
        const key = `${VIEWED_PREFIX}${ip}:${boardId}:${postId}`;
        const exists = await getRedis().exists(key);
        return exists === 1;
    } catch {
        return false; // Redis 장애 시 허용 (조회수 약간 늘어날 수 있음)
    }
}

/** IP 기반 조회 기록 저장 (Redis — pod 간 공유) */
export async function markViewed(ip: string, boardId: string, postId: number): Promise<void> {
    try {
        const key = `${VIEWED_PREFIX}${ip}:${boardId}:${postId}`;
        await getRedis().setex(key, VIEWED_TTL_SEC, '1');
    } catch {
        // Redis 장애 시 무시
    }
}

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

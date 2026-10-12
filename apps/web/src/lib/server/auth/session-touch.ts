/**
 * 세션 last_active_at 터치 스로틀 — 파드 간 공유.
 *
 * 파드마다 메모리 표식(lastDbUpdate)만으로 간격을 재면 파드 수만큼 같은 세션을 중복 갱신한다.
 * Redis `SET key 1 NX EX <ttl>` 로 「이 세션은 최근에 누군가 갱신했다」를 공유해
 * 간격 안에서는 클러스터 전체에서 한 번만 UPDATE 하게 한다.
 *
 * Redis 장애 시에는 'error' 를 돌려주고, 호출부는 예전처럼 파드별 판정만으로 갱신한다
 * (요청을 실패시키거나 갱신을 완전히 멈추지 않는다).
 */

/** last_active_at 갱신 간격(ms) — 1시간 */
export const LAST_ACTIVE_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

const TOUCH_KEY_PREFIX = 'sess:touch:';

/** 이 함수가 쓰는 Redis 명령만 좁힌 타입(테스트에서 가짜 객체 주입용) */
export interface TouchThrottleRedis {
    set(key: string, value: string, mode: 'EX', seconds: number, flag: 'NX'): Promise<unknown>;
}

export type TouchSlot = 'acquired' | 'taken' | 'error';

export function touchKeyFor(sessionIdHash: string): string {
    return `${TOUCH_KEY_PREFIX}${sessionIdHash}`;
}

/**
 * 갱신 권한 획득 시도.
 * - 'acquired': 간격 안에서 처음 — 이 호출부가 UPDATE 한다.
 * - 'taken': 다른 파드(또는 이전 요청)가 간격 안에 이미 갱신했다 — UPDATE 생략.
 * - 'error': Redis 장애 — 호출부는 파드별 판정으로 폴백(UPDATE 한다).
 */
export async function acquireTouchSlot(
    redis: TouchThrottleRedis,
    sessionIdHash: string,
    intervalMs: number = LAST_ACTIVE_UPDATE_INTERVAL_MS
): Promise<TouchSlot> {
    try {
        const ttlSec = Math.max(1, Math.floor(intervalMs / 1000));
        const res = await redis.set(touchKeyFor(sessionIdHash), '1', 'EX', ttlSec, 'NX');
        return res === 'OK' ? 'acquired' : 'taken';
    } catch {
        return 'error';
    }
}

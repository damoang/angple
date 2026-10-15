/**
 * 게임 순위 API 속도 제한 — 기존 rate-limit.ts(파드별 메모리)를 쓴다.
 * start·finish 는 회원 아이디로, 순위표는 IP 로(못 구하면 건너뛴다) 센다.
 */
import { checkRateLimit, recordAttempt } from '$lib/server/rate-limit';

export const LIMITS = {
    start: { action: 'game-rank-start', max: 30, windowMs: 10 * 60 * 1000 },
    finish: { action: 'game-rank-finish', max: 30, windowMs: 10 * 60 * 1000 },
    board: { action: 'game-rank-board', max: 120, windowMs: 60 * 1000 }
} as const;

/** 허용이면 시도를 세고 null, 막히면 다시 해도 되는 초 */
export function hitLimit(kind: keyof typeof LIMITS, key: string): number | null {
    const l = LIMITS[kind];
    const r = checkRateLimit(key, l.action, l.max, l.windowMs);
    if (!r.allowed) return r.retryAfter ?? 60;
    recordAttempt(key, l.action);
    return null;
}

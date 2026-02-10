/**
 * IP 기반 Rate Limiting (메모리 기반)
 *
 * 서버 재시작 시 초기화됨 — 단일 프로세스 환경에서 충분
 */

interface RateLimitEntry {
    count: number;
    firstAttempt: number;
}

const store = new Map<string, RateLimitEntry>();

// 5분마다 만료된 항목 정리
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_WINDOW = 60 * 60 * 1000; // 최대 윈도우 1시간

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now - entry.firstAttempt > MAX_WINDOW) {
            store.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

/**
 * Rate limit 체크
 * @returns allowed: true이면 요청 허용, false이면 차단
 */
export function checkRateLimit(
    ip: string,
    action: string,
    maxAttempts: number,
    windowMs: number
): { allowed: boolean; retryAfter?: number } {
    const key = `${action}:${ip}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry) {
        return { allowed: true };
    }

    // 윈도우 만료 → 초기화
    if (now - entry.firstAttempt > windowMs) {
        store.delete(key);
        return { allowed: true };
    }

    if (entry.count >= maxAttempts) {
        const retryAfter = Math.ceil((entry.firstAttempt + windowMs - now) / 1000);
        return { allowed: false, retryAfter };
    }

    return { allowed: true };
}

/**
 * 시도 기록
 */
export function recordAttempt(ip: string, action: string): void {
    const key = `${action}:${ip}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry) {
        store.set(key, { count: 1, firstAttempt: now });
    } else {
        entry.count++;
    }
}

/**
 * 시도 횟수 초기화 (성공 시 호출)
 */
export function resetAttempts(ip: string, action: string): void {
    const key = `${action}:${ip}`;
    store.delete(key);
}

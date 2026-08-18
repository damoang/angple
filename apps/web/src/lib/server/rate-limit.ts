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
 * 요청의 클라이언트 IP 를 안전하게 얻는다. 못 구하면 null.
 *
 * ⛔ `getClientAddress()` 를 그대로 부르지 마라. `ADDRESS_HEADER=x-real-ip` 환경에서
 *    그 헤더가 없으면 **throw** 하고, 그대로 500 이 된다.
 *    SvelteKit 의 `event.fetch` 로 자기 API 를 호출하는 SSR 경로에는 x-real-ip 가
 *    실리지 않는다(쿠키·인증 헤더만 승계된다).
 *
 *    2026-08-19 실측 사고: 글 상세 SSR 이 `event.fetch` 로 댓글 API 를 부르는데
 *    이 throw 로 500 이 나면서 **시간당 약 3.6만 건**의 오류가 났고, SSR 이 댓글을
 *    통째로 못 실었다. 화면에는 "리플 (4)" 인데 댓글이 0개로 보였다.
 *
 * IP 를 못 구했으면 **호출부는 속도제한을 건너뛴다.** 키가 없으면 애초에 제한을
 * 걸 수 없고, 못 건다는 이유로 요청을 죽이는 건 더 나쁘다(제한은 남용 억제 수단이지
 * 인증 수단이 아니다).
 */
export function resolveClientIp(getClientAddress: () => string, request: Request): string | null {
    try {
        const ip = getClientAddress();
        if (ip) return ip;
    } catch {
        // ADDRESS_HEADER 부재 — 아래 헤더 폴백으로 넘어간다
    }
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    return request.headers.get('x-real-ip')?.trim() || null;
}

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

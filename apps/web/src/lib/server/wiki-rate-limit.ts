/**
 * 위키 편집 저장(생성/수정/되돌리기)용 IP 기반 레이트리밋 (Redis)
 *
 * 기존 rate-limit.ts 는 인메모리(Map)라 파드마다 카운터가 따로 존재한다.
 * 익명편집은 파드가 여러 개면 "파드 수 × 한도"까지 뚫리므로, 여러 파드가
 * 공유하는 Redis 카운터(고정 윈도우 INCR+PEXPIRE)로 IP당 한도를 강제한다.
 *
 * - 익명(userId=null): 원본 IP 기준으로 카운트
 * - 로그인 회원(userId 있음): 회원 ID 기준으로 카운트
 *   (사무실/모바일 NAT 처럼 다수가 한 IP를 공유해도 회원끼리 서로의 한도를
 *    깎지 않도록 주체를 분리한다. 한도 수치 자체는 익명과 동일 적용.)
 * - IP·회원ID 모두 알 수 없으면(SSR 내부 fetch 등) 카운트 불가 → 허용.
 *
 * 실패 정책: Redis 장애 시 fail-open(허용). 레이트리밋은 어뷰즈 완화 장치이지
 * 인증/차단 게이트가 아니므로, Redis가 잠깐 죽었다고 정상 사용자의 편집을
 * 막지 않는다. (실제 차단은 wikiang_ip_blocks → isIpBlocked 가 담당.)
 */
import { getRedis } from '$lib/server/redis';

/**
 * IP(또는 회원)당 위키 편집 한도. 조정하기 쉽도록 상수로 분리.
 * 분당 5회 / 시간당 40회.
 */
export const WIKI_EDIT_RATE_LIMIT = {
    perMinute: { max: 5, windowMs: 60_000 },
    perHour: { max: 40, windowMs: 60 * 60_000 }
} as const;

export interface RateLimitResult {
    allowed: boolean;
    /** 차단 시 재시도까지 남은 초 */
    retryAfter?: number;
    /** 어느 윈도우에 걸렸는지 (minute | hour) — 로깅/디버깅용 */
    scope?: 'minute' | 'hour';
}

/**
 * 단일 고정 윈도우 카운트+판정.
 * INCR 로 시도를 세고, 첫 시도(count===1)일 때만 PEXPIRE 로 윈도우를 건다.
 * (이후 증가에서는 만료를 갱신하지 않으므로 윈도우가 무한 연장되지 않는다.)
 */
async function hitWindow(
    key: string,
    max: number,
    windowMs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
    const redis = getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
        await redis.pexpire(key, windowMs);
    }
    if (count > max) {
        let ttl = await redis.pttl(key);
        // TTL 미설정(-1)/키없음(-2) 방어: 윈도우를 다시 걸어 준다.
        if (ttl < 0) {
            await redis.pexpire(key, windowMs);
            ttl = windowMs;
        }
        return { allowed: false, retryAfter: Math.ceil(ttl / 1000) };
    }
    return { allowed: true };
}

/**
 * 위키 편집 저장 레이트리밋 체크(및 카운트).
 * 요청 1건당 한 번 호출한다. 분당 → 시간당 순으로 검사한다.
 */
export async function checkWikiEditRateLimit(
    ip: string | null,
    userId: number | null
): Promise<RateLimitResult> {
    // 주체를 특정할 수 없으면 카운트 불가 → 허용 (isIpBlocked 와 동일 정책)
    const subject = userId != null ? `u:${userId}` : ip ? `ip:${ip}` : null;
    if (!subject) return { allowed: true };

    try {
        const minKey = `wiki:rl:m:${subject}`;
        const min = await hitWindow(
            minKey,
            WIKI_EDIT_RATE_LIMIT.perMinute.max,
            WIKI_EDIT_RATE_LIMIT.perMinute.windowMs
        );
        if (!min.allowed) {
            return { allowed: false, retryAfter: min.retryAfter, scope: 'minute' };
        }

        const hourKey = `wiki:rl:h:${subject}`;
        const hour = await hitWindow(
            hourKey,
            WIKI_EDIT_RATE_LIMIT.perHour.max,
            WIKI_EDIT_RATE_LIMIT.perHour.windowMs
        );
        if (!hour.allowed) {
            return { allowed: false, retryAfter: hour.retryAfter, scope: 'hour' };
        }

        return { allowed: true };
    } catch (err) {
        // fail-open: Redis 장애로 정상 편집을 막지 않는다.
        console.warn(
            '[wiki-rate-limit] Redis 오류 — 레이트리밋 우회(허용):',
            err instanceof Error ? err.message : err
        );
        return { allowed: true };
    }
}

/**
 * 429 응답 생성 헬퍼. Retry-After 헤더를 포함한다.
 */
export function rateLimitedResponse(retryAfter?: number): Response {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (retryAfter && retryAfter > 0) {
        headers['Retry-After'] = String(retryAfter);
    }
    return new Response(
        JSON.stringify({
            message: '편집 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
            retryAfter: retryAfter ?? null
        }),
        { status: 429, headers }
    );
}

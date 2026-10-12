/**
 * 로그인 회원 페이지 로드 시 접속 기록·일일 보상 호출 판정 — DB 를 직접 만지지 않는 판정 로직.
 *
 * 1) 접속 시각(mb_today_login·mb_login_ip): 저장값이 오늘(KST)이 아니면 쓰고, 오늘이어도
 *    30분에 한 번은 쓴다. 30분 간격은 Redis `SET login:touch:{mb_id} 1 NX EX 1800` 로 파드 간 공유.
 *    Redis 오류면 「오늘(KST) 아님」 판정만으로 쓴다(요청은 절대 실패시키지 않음).
 * 2) XP·포인트·승급: 회원당 UTC 날짜별 1회만 호출한다(메모 키 `login:reward:{mb_id}:{UTC 날짜}`).
 *    지급 여부의 정본은 각 함수 안의 하루 1회 가드(UTC 날짜 키)이고, 메모는 같은 날 반복 호출
 *    (승급 판정의 쓰기 커넥션 FOR UPDATE 트랜잭션 포함)을 줄이기만 한다. 보상 날짜 경계는
 *    지금과 같은 UTC 00:00(= KST 09:00) 이다. 호출이 실패하면 메모를 풀어 다음 로드에서 재시도.
 *    Redis 오류면 파드별 메모(같은 키)로 폴백한다.
 */
import { needsLoginTimestampUpdate } from './login-day.js';

/** 접속 시각 재기록 간격(초) — 30분 */
export const LOGIN_TOUCH_INTERVAL_SEC = 30 * 60;

/** 보상 호출 메모 TTL(초) — 날짜가 키에 들어가므로 이틀이면 충분 */
export const LOGIN_REWARD_MEMO_TTL_SEC = 2 * 24 * 60 * 60;

/** 이 모듈이 쓰는 Redis 명령만 좁힌 타입(테스트에서 가짜 객체 주입용) */
export interface LoginActivityRedis {
    set(key: string, value: string, mode: 'EX', seconds: number, flag: 'NX'): Promise<unknown>;
    del(key: string): Promise<unknown>;
}

/** 보상 함수의 날짜 키와 같은 기준(UTC 날짜) */
export function utcDateString(now: Date): string {
    return now.toISOString().slice(0, 10);
}

export function loginTouchKey(mbId: string): string {
    return `login:touch:${mbId}`;
}

export function loginRewardKey(mbId: string, now: Date): string {
    return `login:reward:${mbId}:${utcDateString(now)}`;
}

/**
 * mb_today_login·mb_login_ip 를 지금 써야 하는지.
 * - 저장값이 오늘(KST)이 아니면 항상 true
 * - 오늘이어도 30분 표식을 새로 잡으면(SET NX 성공) true
 * - Redis 없음/오류 → 「오늘(KST) 아님」 판정만 따른다
 */
export async function shouldWriteLoginTimestamp(
    redis: LoginActivityRedis | null,
    mbId: string,
    lastLogin: unknown,
    now: Date = new Date()
): Promise<boolean> {
    const notToday = needsLoginTimestampUpdate(lastLogin, now);
    if (!redis) return notToday;
    try {
        const res = await redis.set(loginTouchKey(mbId), '1', 'EX', LOGIN_TOUCH_INTERVAL_SEC, 'NX');
        return notToday || res === 'OK';
    } catch {
        return notToday;
    }
}

export interface LoginRewardFns {
    grantLoginXP(mbId: string): Promise<unknown>;
    grantLoginPoint(mbId: string): Promise<unknown>;
    checkAndPromoteMember(mbId: string): Promise<unknown>;
}

/** 파드별 폴백 메모 상한 — 넘으면 비운다(가드는 함수 안에 있으므로 비워도 안전) */
const LOCAL_MEMO_MAX = 20_000;

/**
 * 회원·UTC 날짜별 보상 호출 메모. Redis 를 우선 쓰고, 오류면 파드별 Set 으로 폴백한다.
 */
export function createLoginRewardMemo() {
    let localDate = '';
    const local = new Set<string>();

    function localAcquire(key: string, now: Date): boolean {
        const date = utcDateString(now);
        if (date !== localDate) {
            local.clear();
            localDate = date;
        }
        if (local.has(key)) return false;
        if (local.size >= LOCAL_MEMO_MAX) local.clear();
        local.add(key);
        return true;
    }

    return {
        /** 오늘(UTC) 이 회원의 보상 호출 권한을 처음 잡으면 true */
        async acquire(
            redis: LoginActivityRedis | null,
            mbId: string,
            now: Date = new Date()
        ): Promise<boolean> {
            const key = loginRewardKey(mbId, now);
            if (redis) {
                try {
                    const res = await redis.set(key, '1', 'EX', LOGIN_REWARD_MEMO_TTL_SEC, 'NX');
                    return res === 'OK';
                } catch {
                    // Redis 오류 → 파드별 메모
                }
            }
            return localAcquire(key, now);
        },

        /** 호출 실패 시 메모를 풀어 다음 로드에서 다시 시도하게 한다 */
        async release(
            redis: LoginActivityRedis | null,
            mbId: string,
            now: Date = new Date()
        ): Promise<void> {
            const key = loginRewardKey(mbId, now);
            local.delete(key);
            if (!redis) return;
            try {
                await redis.del(key);
            } catch {
                // 무시 — TTL 로 정리됨
            }
        }
    };
}

export type LoginRewardMemo = ReturnType<typeof createLoginRewardMemo>;

/**
 * 일일 로그인 보상(XP·포인트) + 승급 판정을 회원·UTC 날짜별 1회만 호출한다.
 * @returns 이번에 호출했으면 true(메모에 막혔으면 false)
 */
export async function runDailyLoginRewards(
    memo: LoginRewardMemo,
    redis: LoginActivityRedis | null,
    mbId: string,
    fns: LoginRewardFns,
    now: Date = new Date()
): Promise<boolean> {
    if (!(await memo.acquire(redis, mbId, now))) return false;

    const results = await Promise.allSettled([fns.grantLoginXP(mbId), fns.grantLoginPoint(mbId)]);
    let ok = results.every((r) => r.status === 'fulfilled');
    try {
        await fns.checkAndPromoteMember(mbId);
    } catch {
        ok = false;
    }
    if (!ok) await memo.release(redis, mbId, now);
    return true;
}

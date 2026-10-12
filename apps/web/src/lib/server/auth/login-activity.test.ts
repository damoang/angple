import { describe, it, expect, vi } from 'vitest';
import {
    LOGIN_PROMOTE_INTERVAL_SEC,
    LOGIN_REWARD_MEMO_TTL_SEC,
    LOGIN_TOUCH_INTERVAL_SEC,
    createLoginMemos,
    loginPromoteKey,
    loginRewardKey,
    loginTouchKey,
    runLoginRewards,
    shouldWriteLoginTimestamp,
    type LoginActivityRedis
} from './login-activity';

/** SET NX EX·DEL 만 흉내 내는 가짜 Redis — 여러 파드가 공유하는 하나의 인스턴스 */
function fakeRedis() {
    const store = new Map<string, string>();
    const calls: unknown[][] = [];
    const redis: LoginActivityRedis = {
        async set(key, value, mode, seconds, flag) {
            calls.push([key, value, mode, seconds, flag]);
            if (store.has(key)) return null;
            store.set(key, value);
            return 'OK';
        },
        async del(key) {
            return store.delete(key) ? 1 : 0;
        }
    };
    return { redis, store, calls };
}

const brokenRedis: LoginActivityRedis = {
    async set() {
        throw new Error('connection refused');
    },
    async del() {
        throw new Error('connection refused');
    }
};

function rewardFns() {
    return {
        grantLoginXP: vi.fn(async () => undefined),
        grantLoginPoint: vi.fn(async () => undefined),
        checkAndPromoteMember: vi.fn(async () => null)
    };
}

// 2026-10-12 10:00 KST (UTC 01:00)
const morning = new Date('2026-10-12T01:00:00.000Z');

describe('shouldWriteLoginTimestamp', () => {
    it('저장값이 오늘(KST) 아님 → true, 30분 표식도 잡는다', async () => {
        const { redis, calls } = fakeRedis();
        const last = new Date('2026-10-11T01:00:00.000Z');
        expect(await shouldWriteLoginTimestamp(redis, 'u1', last, morning)).toBe(true);
        expect(calls[0]).toEqual([loginTouchKey('u1'), '1', 'EX', LOGIN_TOUCH_INTERVAL_SEC, 'NX']);
        expect(LOGIN_TOUCH_INTERVAL_SEC).toBe(1800);
    });

    it('오늘(KST) 기록 있음 + 30분 표식 없음 → true (30분 간격 갱신)', async () => {
        const { redis } = fakeRedis();
        expect(await shouldWriteLoginTimestamp(redis, 'u1', morning, morning)).toBe(true);
    });

    it('오늘(KST) 기록 있음 + 30분 안(다른 파드가 이미 씀) → false', async () => {
        const { redis } = fakeRedis();
        await shouldWriteLoginTimestamp(redis, 'u1', morning, morning);
        expect(await shouldWriteLoginTimestamp(redis, 'u1', morning, morning)).toBe(false);
    });

    it('30분 안이라도 KST 날짜가 바뀌었으면 → true', async () => {
        const { redis } = fakeRedis();
        const kst2359 = new Date('2026-10-12T14:59:00.000Z');
        const kst0001 = new Date('2026-10-12T15:01:00.000Z');
        await shouldWriteLoginTimestamp(redis, 'u1', kst2359, kst2359);
        expect(await shouldWriteLoginTimestamp(redis, 'u1', kst2359, kst0001)).toBe(true);
    });

    it('Redis 오류·없음 → KST 날짜 판정만', async () => {
        const yesterday = new Date('2026-10-11T01:00:00.000Z');
        expect(await shouldWriteLoginTimestamp(brokenRedis, 'u1', morning, morning)).toBe(false);
        expect(await shouldWriteLoginTimestamp(brokenRedis, 'u1', yesterday, morning)).toBe(true);
        expect(await shouldWriteLoginTimestamp(null, 'u1', morning, morning)).toBe(false);
        expect(await shouldWriteLoginTimestamp(null, 'u1', null, morning)).toBe(true);
    });
});

describe('runLoginRewards — XP·포인트', () => {
    it('같은 회원·같은 UTC 날짜엔 1회만 호출 (여러 파드 공유)', async () => {
        const { redis, calls } = fakeRedis();
        const podA = createLoginMemos();
        const podB = createLoginMemos();
        const fns = rewardFns();

        expect((await runLoginRewards(podA, redis, 'u1', fns, morning)).rewards).toBe(true);
        expect((await runLoginRewards(podA, redis, 'u1', fns, morning)).rewards).toBe(false);
        expect((await runLoginRewards(podB, redis, 'u1', fns, morning)).rewards).toBe(false);

        expect(fns.grantLoginXP).toHaveBeenCalledTimes(1);
        expect(fns.grantLoginPoint).toHaveBeenCalledTimes(1);
        expect(calls[0]).toEqual([
            loginRewardKey('u1', morning),
            '1',
            'EX',
            LOGIN_REWARD_MEMO_TTL_SEC,
            'NX'
        ]);
    });

    it('날짜 경계는 UTC 00:00(= KST 09:00) — 지금 보상 가드와 같다', async () => {
        const { redis } = fakeRedis();
        const memos = createLoginMemos();
        const fns = rewardFns();
        const kst0100 = new Date('2026-10-11T16:00:00.000Z'); // 10/12 01:00 KST, UTC 10/11
        const kst0859 = new Date('2026-10-11T23:59:00.000Z'); // 10/12 08:59 KST, UTC 10/11
        const kst0900 = new Date('2026-10-12T00:00:00.000Z'); // 10/12 09:00 KST, UTC 10/12

        await runLoginRewards(memos, redis, 'u1', fns, kst0100);
        await runLoginRewards(memos, redis, 'u1', fns, kst0859);
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(1);

        await runLoginRewards(memos, redis, 'u1', fns, kst0900);
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(2);
        expect(loginRewardKey('u1', kst0859)).toBe('login:reward:u1:2026-10-11');
        expect(loginRewardKey('u1', kst0900)).toBe('login:reward:u1:2026-10-12');
    });

    it('회원마다 따로', async () => {
        const { redis } = fakeRedis();
        const memos = createLoginMemos();
        const fns = rewardFns();
        await runLoginRewards(memos, redis, 'u1', fns, morning);
        await runLoginRewards(memos, redis, 'u2', fns, morning);
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(2);
    });

    it('호출 실패 → 메모를 풀어 다음 로드에서 재시도', async () => {
        const { redis } = fakeRedis();
        const memos = createLoginMemos();
        const fns = rewardFns();
        fns.grantLoginPoint.mockRejectedValueOnce(new Error('db blip'));

        await runLoginRewards(memos, redis, 'u1', fns, morning);
        expect((await runLoginRewards(memos, redis, 'u1', fns, morning)).rewards).toBe(true);
        expect((await runLoginRewards(memos, redis, 'u1', fns, morning)).rewards).toBe(false);
        expect(fns.grantLoginPoint).toHaveBeenCalledTimes(2);
    });

    it('Redis 오류 → 파드별 메모로 UTC 날짜별 1회', async () => {
        const memos = createLoginMemos();
        const fns = rewardFns();
        await runLoginRewards(memos, brokenRedis, 'u1', fns, morning);
        await runLoginRewards(memos, brokenRedis, 'u1', fns, morning);
        await runLoginRewards(memos, null, 'u1', fns, morning);
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(1);

        const nextUtcDay = new Date('2026-10-13T01:00:00.000Z');
        await runLoginRewards(memos, brokenRedis, 'u1', fns, nextUtcDay);
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(2);
    });
});

describe('runLoginRewards — 승급 판정', () => {
    it('30분에 1회 (여러 파드 공유), SET NX EX 1800', async () => {
        const { redis, calls } = fakeRedis();
        const podA = createLoginMemos();
        const podB = createLoginMemos();
        const fns = rewardFns();

        expect((await runLoginRewards(podA, redis, 'u1', fns, morning)).promote).toBe(true);
        expect((await runLoginRewards(podB, redis, 'u1', fns, morning)).promote).toBe(false);
        expect(fns.checkAndPromoteMember).toHaveBeenCalledTimes(1);
        expect(LOGIN_PROMOTE_INTERVAL_SEC).toBe(1800);
        expect(calls).toContainEqual([loginPromoteKey('u1'), '1', 'EX', 1800, 'NX']);
    });

    it('같은 UTC 날짜라도 30분 표식이 풀리면 다시 판정 — 하루 중간 승급', async () => {
        const { redis, store } = fakeRedis();
        const memos = createLoginMemos();
        const fns = rewardFns();

        await runLoginRewards(memos, redis, 'u1', fns, morning);
        // 30분 TTL 만료를 흉내
        store.delete(loginPromoteKey('u1'));
        const later = new Date(morning.getTime() + 31 * 60 * 1000);
        const res = await runLoginRewards(memos, redis, 'u1', fns, later);

        expect(res).toEqual({ rewards: false, promote: true });
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(1);
        expect(fns.checkAndPromoteMember).toHaveBeenCalledTimes(2);
    });

    it('보상 → 승급 순서로 호출', async () => {
        const { redis } = fakeRedis();
        const memos = createLoginMemos();
        const order: string[] = [];
        const fns = {
            grantLoginXP: vi.fn(async () => {
                order.push('xp');
            }),
            grantLoginPoint: vi.fn(async () => {
                order.push('point');
            }),
            checkAndPromoteMember: vi.fn(async () => {
                order.push('promote');
            })
        };
        await runLoginRewards(memos, redis, 'u1', fns, morning);
        expect(order[2]).toBe('promote');
    });

    it('승급 판정 실패 → 메모를 풀어 재시도', async () => {
        const { redis } = fakeRedis();
        const memos = createLoginMemos();
        const fns = rewardFns();
        fns.checkAndPromoteMember.mockRejectedValueOnce(new Error('lock wait timeout'));

        await runLoginRewards(memos, redis, 'u1', fns, morning);
        await runLoginRewards(memos, redis, 'u1', fns, morning);
        await runLoginRewards(memos, redis, 'u1', fns, morning);
        expect(fns.checkAndPromoteMember).toHaveBeenCalledTimes(2);
    });

    it('Redis 오류 → 파드별 메모, 30분 구간이 바뀌면 다시 판정', async () => {
        const memos = createLoginMemos();
        const fns = rewardFns();
        await runLoginRewards(memos, brokenRedis, 'u1', fns, morning);
        await runLoginRewards(memos, brokenRedis, 'u1', fns, morning);
        expect(fns.checkAndPromoteMember).toHaveBeenCalledTimes(1);

        const nextBucket = new Date(morning.getTime() + 30 * 60 * 1000);
        await runLoginRewards(memos, brokenRedis, 'u1', fns, nextBucket);
        expect(fns.checkAndPromoteMember).toHaveBeenCalledTimes(2);
        expect(fns.grantLoginXP).toHaveBeenCalledTimes(1);
    });
});

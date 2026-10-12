import { describe, it, expect } from 'vitest';
import {
    LAST_ACTIVE_UPDATE_INTERVAL_MS,
    acquireTouchSlot,
    touchKeyFor,
    type TouchThrottleRedis
} from './session-touch';

/** SET NX EX 만 흉내 내는 가짜 Redis — 여러 파드가 같은 인스턴스를 공유하는 상황 */
function fakeRedis(): TouchThrottleRedis & { calls: unknown[][]; store: Map<string, string> } {
    const store = new Map<string, string>();
    const calls: unknown[][] = [];
    return {
        store,
        calls,
        async set(key, value, mode, seconds, flag) {
            calls.push([key, value, mode, seconds, flag]);
            if (store.has(key)) return null;
            store.set(key, value);
            return 'OK';
        }
    };
}

describe('acquireTouchSlot', () => {
    it('간격은 1시간', () => {
        expect(LAST_ACTIVE_UPDATE_INTERVAL_MS).toBe(60 * 60 * 1000);
    });

    it('처음 → acquired, SET NX EX 3600 으로 요청', async () => {
        const redis = fakeRedis();
        expect(await acquireTouchSlot(redis, 'h1')).toBe('acquired');
        expect(redis.calls[0]).toEqual([touchKeyFor('h1'), '1', 'EX', 3600, 'NX']);
    });

    it('간격 안 두 번째(다른 파드) → taken', async () => {
        const redis = fakeRedis();
        expect(await acquireTouchSlot(redis, 'h1')).toBe('acquired');
        expect(await acquireTouchSlot(redis, 'h1')).toBe('taken');
    });

    it('세션마다 따로 판정', async () => {
        const redis = fakeRedis();
        expect(await acquireTouchSlot(redis, 'h1')).toBe('acquired');
        expect(await acquireTouchSlot(redis, 'h2')).toBe('acquired');
    });

    it('Redis 오류 → error (호출부는 파드별 판정으로 갱신)', async () => {
        const broken: TouchThrottleRedis = {
            async set() {
                throw new Error('connection refused');
            }
        };
        expect(await acquireTouchSlot(broken, 'h1')).toBe('error');
    });

    it('TTL 은 최소 1초', async () => {
        const redis = fakeRedis();
        await acquireTouchSlot(redis, 'h1', 10);
        expect(redis.calls[0][3]).toBe(1);
    });
});

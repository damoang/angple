import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

let result: unknown[] | Error | 'hang' = [];
const calls: string[] = [];

vi.mock('$lib/server/db.js', () => ({
    readPool: {
        query: (sql: string) => {
            calls.push(sql);
            if (result === 'hang') return new Promise(() => {}); // 풀 포화로 끝나지 않는 쿼리
            return result instanceof Error ? Promise.reject(result) : Promise.resolve([result]);
        }
    }
}));

import {
    clearPollSetCacheForTest,
    fetchHasPoll,
    HAS_POLL_TIMEOUT_MS,
    POLL_SET_LOAD_TIMEOUT_MS,
    POLL_SET_TTL_MS
} from './poll-presence.js';

describe('fetchHasPoll', () => {
    beforeEach(() => {
        result = [];
        calls.length = 0;
        clearPollSetCacheForTest();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('집합에 있으면 true', async () => {
        result = [{ bo_table: 'free', wr_id: 123 }];
        await expect(fetchHasPoll('free', 123)).resolves.toBe(true);
        expect(calls).toEqual(['SELECT bo_table, wr_id FROM angple_polls']);
    });

    it('집합에 없으면 false', async () => {
        result = [{ bo_table: 'free', wr_id: 1 }];
        await expect(fetchHasPoll('free', 123)).resolves.toBe(false);
        await expect(fetchHasPoll('qa', 1)).resolves.toBe(false);
    });

    it('게시판 비교는 대소문자를 가리지 않는다', async () => {
        result = [{ bo_table: 'Free', wr_id: 7 }];
        await expect(fetchHasPoll('free', 7)).resolves.toBe(true);
    });

    it('집합은 TTL 동안 한 번만 읽는다', async () => {
        result = [{ bo_table: 'free', wr_id: 123 }];
        await fetchHasPoll('free', 123);
        await fetchHasPoll('free', 456);
        await fetchHasPoll('qa', 1);
        expect(calls).toHaveLength(1);
    });

    it('동시 조회는 쿼리 하나를 나눠 쓴다', async () => {
        result = [{ bo_table: 'free', wr_id: 123 }];
        const results = await Promise.all([fetchHasPoll('free', 123), fetchHasPoll('free', 1)]);
        expect(results).toEqual([true, false]);
        expect(calls).toHaveLength(1);
    });

    it('TTL 이 지나면 다시 읽어 새 투표를 반영한다', async () => {
        vi.useFakeTimers();
        result = [];
        await expect(fetchHasPoll('free', 123)).resolves.toBe(false);
        result = [{ bo_table: 'free', wr_id: 123 }];
        vi.setSystemTime(Date.now() + POLL_SET_TTL_MS + 1);
        await expect(fetchHasPoll('free', 123)).resolves.toBe(true);
        expect(calls).toHaveLength(2);
    });

    it('DB 실패는 null (모름 — 위젯이 기존처럼 호출)', async () => {
        result = new Error('connection lost');
        await expect(fetchHasPoll('free', 123)).resolves.toBeNull();
    });

    it('실패는 캐시하지 않는다 — 다음 조회가 다시 읽는다', async () => {
        result = new Error('connection lost');
        await expect(fetchHasPoll('free', 123)).resolves.toBeNull();
        result = [{ bo_table: 'free', wr_id: 123 }];
        await expect(fetchHasPoll('free', 123)).resolves.toBe(true);
        expect(calls).toHaveLength(2);
    });

    it('느린 쿼리는 타임아웃 뒤 null (본문 SSR 을 붙잡지 않는다)', async () => {
        vi.useFakeTimers();
        result = 'hang';
        const pending = fetchHasPoll('free', 123);
        vi.advanceTimersByTime(HAS_POLL_TIMEOUT_MS);
        await expect(pending).resolves.toBeNull();
    });

    it('끝나지 않는 집합 로드는 끊겨 다음 조회가 다시 읽는다', async () => {
        vi.useFakeTimers();
        result = 'hang';
        const first = fetchHasPoll('free', 123);
        vi.advanceTimersByTime(HAS_POLL_TIMEOUT_MS);
        await expect(first).resolves.toBeNull();
        await vi.advanceTimersByTimeAsync(POLL_SET_LOAD_TIMEOUT_MS);
        result = [{ bo_table: 'free', wr_id: 123 }];
        await expect(fetchHasPoll('free', 123)).resolves.toBe(true);
        expect(calls).toHaveLength(2);
    });

    it('잘못된 인자는 조회 없이 null', async () => {
        await expect(fetchHasPoll('free', Number('abc'))).resolves.toBeNull();
        await expect(fetchHasPoll('', 1)).resolves.toBeNull();
        expect(calls).toHaveLength(0);
    });
});

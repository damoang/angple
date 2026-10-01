import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

let result: unknown[] | Error | 'hang' = [];
const calls: unknown[][] = [];

vi.mock('$lib/server/db.js', () => ({
    readPool: {
        query: (_sql: string, params: unknown[]) => {
            calls.push(params);
            if (result === 'hang') return new Promise(() => {}); // 풀 포화로 끝나지 않는 쿼리
            return result instanceof Error ? Promise.reject(result) : Promise.resolve([result]);
        }
    }
}));

import { fetchHasPoll, HAS_POLL_TIMEOUT_MS } from './poll-presence.js';

describe('fetchHasPoll', () => {
    beforeEach(() => {
        result = [];
        calls.length = 0;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('행이 있으면 true', async () => {
        result = [{ 1: 1 }];
        await expect(fetchHasPoll('free', 123)).resolves.toBe(true);
        expect(calls[0]).toEqual(['free', 123]);
    });

    it('행이 없으면 false', async () => {
        await expect(fetchHasPoll('free', 123)).resolves.toBe(false);
    });

    it('DB 실패는 null (모름 — 위젯이 기존처럼 호출)', async () => {
        result = new Error('connection lost');
        await expect(fetchHasPoll('free', 123)).resolves.toBeNull();
    });

    it('느린 쿼리는 타임아웃 뒤 null (본문 SSR 을 붙잡지 않는다)', async () => {
        vi.useFakeTimers();
        result = 'hang';
        const pending = fetchHasPoll('free', 123);
        vi.advanceTimersByTime(HAS_POLL_TIMEOUT_MS);
        await expect(pending).resolves.toBeNull();
    });

    it('잘못된 인자는 조회 없이 null', async () => {
        await expect(fetchHasPoll('free', Number('abc'))).resolves.toBeNull();
        await expect(fetchHasPoll('', 1)).resolves.toBeNull();
        expect(calls).toHaveLength(0);
    });
});

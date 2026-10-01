import { describe, expect, it, vi, beforeEach } from 'vitest';

let result: unknown[] | Error = [];
const calls: unknown[][] = [];

vi.mock('$lib/server/db.js', () => ({
    readPool: {
        query: (_sql: string, params: unknown[]) => {
            calls.push(params);
            return result instanceof Error ? Promise.reject(result) : Promise.resolve([result]);
        }
    }
}));

import { fetchHasPoll } from './poll-presence.js';

describe('fetchHasPoll', () => {
    beforeEach(() => {
        result = [];
        calls.length = 0;
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

    it('잘못된 인자는 조회 없이 null', async () => {
        await expect(fetchHasPoll('free', Number('abc'))).resolves.toBeNull();
        await expect(fetchHasPoll('', 1)).resolves.toBeNull();
        expect(calls).toHaveLength(0);
    });
});

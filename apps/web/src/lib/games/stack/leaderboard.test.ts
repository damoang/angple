/**
 * 앙쌓기 점수판 — 기록 시각 KST 표시와 불러오기.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LEADERBOARD_SIZE, fetchLeaderboard, formatAchievedAt } from './leaderboard';

describe('formatAchievedAt', () => {
    // 2026-10-11 20:00 KST
    const now = new Date('2026-10-11T20:00:00+09:00');

    it('오늘(KST) 기록은 시:분만', () => {
        expect(formatAchievedAt('2026-10-11T14:05:00+09:00', now)).toBe('14:05');
        expect(formatAchievedAt('2026-10-11T09:03:07+09:00', now.getTime())).toBe('09:03');
    });

    it('다른 날 기록은 월·일까지', () => {
        expect(formatAchievedAt('2026-10-09T08:03:00+09:00', now)).toBe('10월 9일 08:03');
        expect(formatAchievedAt('2025-12-31T23:59:59+09:00', now)).toBe('12월 31일 23:59');
    });

    it('Z(UTC) 표기도 KST 로 바꿔 보여 준다', () => {
        // 05:05Z = 14:05 KST
        expect(formatAchievedAt('2026-10-11T05:05:00Z', now)).toBe('14:05');
    });

    it('비었거나 틀린 값은 빈칸', () => {
        for (const bad of [
            undefined,
            null,
            '',
            12345,
            'abc',
            '2026',
            '2026-10-11',
            '2026-10-11 14:05:00',
            '2026-10-11T14:05:00'
        ]) {
            expect(formatAchievedAt(bad, now)).toBe('');
        }
        expect(formatAchievedAt('2026-10-11T14:05:00+09:00', Number.NaN)).toBe('');
    });

    describe('브라우저가 한국 시간대가 아닐 때 (KST 자정 경계)', () => {
        const savedTZ = process.env.TZ;
        beforeAll(() => {
            // 로스앤젤레스: KST 자정 무렵이 그곳에선 전날 오전이다
            process.env.TZ = 'America/Los_Angeles';
        });
        afterAll(() => {
            if (savedTZ === undefined) delete process.env.TZ;
            else process.env.TZ = savedTZ;
        });

        // 지금 = 2026-10-12 00:10 KST (= 10-11 15:10 UTC, 로스앤젤레스 10-11 08:10)
        const justAfterMidnight = new Date('2026-10-11T15:10:00Z');

        it('KST 자정 직전 기록은 어제', () => {
            expect(formatAchievedAt('2026-10-11T23:59:00+09:00', justAfterMidnight)).toBe(
                '10월 11일 23:59'
            );
        });

        it('KST 자정 직후 기록은 오늘', () => {
            expect(formatAchievedAt('2026-10-12T00:00:00+09:00', justAfterMidnight)).toBe('00:00');
            expect(formatAchievedAt('2026-10-11T15:05:00Z', justAfterMidnight)).toBe('00:05');
        });

        it('UTC 날짜가 같아도 KST 날짜가 다르면 어제', () => {
            // 10-11 14:59Z 와 지금(10-11 15:10Z)은 UTC 로는 같은 날이지만 KST 로는 10-11 23:59 / 10-12 00:10
            expect(formatAchievedAt('2026-10-11T14:59:00Z', justAfterMidnight)).toBe(
                '10월 11일 23:59'
            );
        });
    });
});

describe('fetchLeaderboard', () => {
    function okResponse(body: unknown) {
        return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }

    it('줄을 최대 10개로 자르고 weekStart 를 넘긴다', async () => {
        const rows = Array.from({ length: 15 }, (_, i) => ({
            rank: i + 1,
            nickname: `n${i}`,
            score: 100 - i,
            lines: 0,
            level: 1
        }));
        const fetchFn = vi.fn<typeof fetch>(async () =>
            okResponse({ rows, weekStart: '2026-10-05' })
        );
        const out = await fetchLeaderboard('solo_week', { fetchFn });
        expect(LEADERBOARD_SIZE).toBe(10);
        expect(out.rows).toHaveLength(10);
        expect(out.weekStart).toBe('2026-10-05');
        expect(fetchFn).toHaveBeenCalledWith('/stack-ws/leaderboard?board=solo_week', undefined);
    });

    it('fresh 면 브라우저 캐시를 건너뛴다', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () => okResponse({ rows: [] }));
        const out = await fetchLeaderboard('solo_all', { fresh: true, fetchFn });
        expect(out.rows).toEqual([]);
        expect(out.weekStart).toBeUndefined();
        expect(fetchFn).toHaveBeenCalledWith('/stack-ws/leaderboard?board=solo_all', {
            cache: 'no-cache'
        });
    });

    it('rows 가 없으면 빈 목록, 실패 응답이면 throw', async () => {
        const empty = await fetchLeaderboard('vs_attack', {
            fetchFn: vi.fn<typeof fetch>(async () => okResponse({}))
        });
        expect(empty.rows).toEqual([]);
        const failed = { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
        const fetchFn = vi.fn<typeof fetch>(async () => failed);
        await expect(fetchLeaderboard('vs_sprint40', { fetchFn })).rejects.toThrow('503');
    });
});

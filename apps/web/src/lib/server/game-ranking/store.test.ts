/**
 * 게임 순위 저장소 — 표가 없을 때(ER_NO_SUCH_TABLE)의 처리, 트랜잭션, 의심 판은 runs 에만.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pool, readPool } = vi.hoisted(() => ({
    pool: { query: vi.fn(), getConnection: vi.fn() },
    readPool: { query: vi.fn() }
}));
vi.mock('$lib/server/db', () => ({ pool, readPool, default: pool }));
vi.mock('$lib/server/redis', () => ({ getRedis: () => null }));
vi.mock('$lib/server/member-card', () => ({
    fetchMemberCards: async (ids: string[]) =>
        new Map(ids.map((id) => [id, { nick: `nick-${id}`, image: '', isLeft: id === 'gone' }]))
}));

import {
    TablesMissingError,
    resetReadyCache,
    saveRun,
    tablesReady,
    topRows,
    type RunRecord
} from './store';
import { kstWall, weekStartKST, wallToRfc3339 } from './kst';

const noTable = Object.assign(new Error("Table 'x.angple_game_runs' doesn't exist"), {
    code: 'ER_NO_SUCH_TABLE',
    errno: 1146
});

function conn(queryImpl: (sql: string) => unknown) {
    return {
        beginTransaction: vi.fn(async () => undefined),
        commit: vi.fn(async () => undefined),
        rollback: vi.fn(async () => undefined),
        release: vi.fn(),
        query: vi.fn(async (sql: string) => queryImpl(sql))
    };
}

const rec = (over: Partial<RunRecord> = {}): RunRecord => ({
    gameId: 'breakout',
    variant: '',
    runId: 'g_1',
    mbId: 'alice',
    seed: 1,
    score: 100,
    ticks: 600,
    inputsJson: '{}',
    engineVer: 1,
    elapsedMs: 11000,
    flagged: false,
    flagReason: '',
    startedAt: '2026-10-15 12:00:00',
    finishedAt: '2026-10-15 12:00:11',
    weekStart: '2026-10-12',
    ...over
});

beforeEach(() => {
    vi.clearAllMocks();
    resetReadyCache();
});

describe('표 준비 확인', () => {
    it('표가 없으면 false 이고 잠시 기억한다', async () => {
        pool.query.mockRejectedValueOnce(noTable);
        expect(await tablesReady(1000)).toBe(false);
        expect(await tablesReady(2000)).toBe(false);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('표가 있으면 true', async () => {
        pool.query.mockResolvedValueOnce([[], []]);
        expect(await tablesReady(1000)).toBe(true);
    });

    it('다른 DB 오류는 false 지만 기억하지 않는다', async () => {
        pool.query.mockRejectedValueOnce(new Error('timeout'));
        pool.query.mockResolvedValueOnce([[], []]);
        expect(await tablesReady(1000)).toBe(false);
        expect(await tablesReady(1001)).toBe(true);
    });
});

describe('저장', () => {
    it('통과한 판 — runs·best·weekly 를 한 트랜잭션에, 그다음 내 기록', async () => {
        const sqls: string[] = [];
        const c = conn((sql) => {
            sqls.push(sql);
            if (sql.includes('AS week_best')) return [[{ best: 100, week_best: 100 }], []];
            if (sql.includes('COUNT(*)')) return [[{ n: 2 }], []];
            return [{ affectedRows: 1 }, []];
        });
        pool.getConnection.mockResolvedValueOnce(c);
        const st = await saveRun(rec(), true);
        expect(st).toEqual({ best: 100, weekBest: 100, rankWeek: 3 });
        expect(c.beginTransaction).toHaveBeenCalled();
        expect(c.commit).toHaveBeenCalled();
        expect(c.release).toHaveBeenCalled();
        expect(sqls[0]).toContain('INSERT INTO angple_game_runs');
        expect(sqls[1]).toContain('INSERT INTO angple_game_best');
        expect(sqls[2]).toContain('INSERT INTO angple_game_weekly');
    });

    it('의심 판은 runs 에만', async () => {
        const sqls: string[] = [];
        const c = conn((sql) => {
            sqls.push(sql);
            if (sql.includes('AS week_best')) return [[{ best: null, week_best: null }], []];
            return [{ affectedRows: 1 }, []];
        });
        pool.getConnection.mockResolvedValueOnce(c);
        const st = await saveRun(rec({ flagged: true, flagReason: 'score_mismatch' }), true);
        expect(st).toEqual({ best: null, weekBest: null });
        expect(sqls.filter((s) => s.startsWith('INSERT'))).toHaveLength(1);
        expect(sqls.some((s) => s.includes('angple_game_best ('))).toBe(false);
    });

    it('표가 없으면 되돌리고 TablesMissingError', async () => {
        const c = conn(() => {
            throw noTable;
        });
        pool.getConnection.mockResolvedValueOnce(c);
        await expect(saveRun(rec(), true)).rejects.toBeInstanceOf(TablesMissingError);
        expect(c.rollback).toHaveBeenCalled();
        expect(c.commit).not.toHaveBeenCalled();
        expect(c.release).toHaveBeenCalled();
    });
});

describe('순위표', () => {
    it('닉네임은 회원 카드에서, 탈퇴 카드는 빼고 순위를 다시 매긴다', async () => {
        readPool.query.mockResolvedValueOnce([
            [
                { mb_id: 'a', mb_nick: 'A', score: '300', achieved_raw: '2026-10-15 09:00:00' },
                { mb_id: 'gone', mb_nick: 'G', score: 200, achieved_raw: '' },
                { mb_id: 'b', mb_nick: 'B', score: 100, achieved_raw: 'bad' }
            ],
            []
        ]);
        const rows = await topRows('breakout', '', '2026-10-12', true);
        expect(rows).toEqual([
            { rank: 1, nickname: 'nick-a', score: 300, achievedAt: '2026-10-15T09:00:00+09:00' },
            { rank: 2, nickname: 'nick-b', score: 100, achievedAt: '' }
        ]);
        expect(readPool.query.mock.calls[0][1]).toEqual(['breakout', '', '2026-10-12']);
    });

    it('표가 없으면 TablesMissingError', async () => {
        readPool.query.mockRejectedValueOnce(noTable);
        await expect(topRows('breakout', '', null, true)).rejects.toBeInstanceOf(
            TablesMissingError
        );
    });
});

describe('KST', () => {
    it('주 시작은 KST 월요일', () => {
        // 2026-10-18(일) 23:59 KST = 14:59 UTC → 그 주 월요일 10/12
        expect(weekStartKST(Date.UTC(2026, 9, 18, 14, 59))).toBe('2026-10-12');
        // 2026-10-19(월) 00:00 KST = 10/18 15:00 UTC → 10/19
        expect(weekStartKST(Date.UTC(2026, 9, 18, 15, 0))).toBe('2026-10-19');
        expect(kstWall(Date.UTC(2026, 9, 18, 15, 0, 5))).toBe('2026-10-19 00:00:05');
        expect(wallToRfc3339('2026-10-19 00:00:05')).toBe('2026-10-19T00:00:05+09:00');
        expect(wallToRfc3339(null)).toBe('');
    });
});

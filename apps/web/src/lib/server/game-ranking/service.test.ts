/**
 * 게임 순위 — 판 발급·기록 검사·저장 분기.
 * 재생 일치(엔진으로 만든 실제 판), 위조 점수 → flagged, 너무 빠름 → flagged, runId 재사용 거부,
 * 남의 runId 거부, 표 없음 → 준비 중, 낮을수록 좋은 게임의 정렬·갱신 방향.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db', () => ({
    pool: { query: vi.fn(), getConnection: vi.fn() },
    readPool: { query: vi.fn() },
    default: {}
}));
vi.mock('$lib/server/redis', () => ({ getRedis: () => null }));
vi.mock('$lib/server/member-card', () => ({ fetchMemberCards: async () => new Map() }));

import {
    SCALE,
    START_X,
    createGame,
    mulberry32,
    step,
    type Ball
} from '$lib/games/breakout/engine';
import { encodeLog } from '$lib/games/breakout/log-codec';
import { getRankedGame, type RankedGame } from './registry';
import type { IssuedRun, RunStore } from './run-store';
import { START_GAP_MS } from './run-store';
import {
    TablesMissingError,
    aheadSql,
    topSql,
    upsertSql,
    type BoardRow,
    type RunRecord,
    type Standing
} from './store';
import {
    checkClaim,
    clearBoardCache,
    finishRun,
    leaderboard,
    resolveGame,
    startRun,
    type RankingDeps
} from './service';

/** Redis 판 보관소와 같은 규칙의 메모리 판 — 간격·동시 1판·1회용·남의 판은 건드리지 않음 */
function memoryRuns(clock: () => number): RunStore & { runs: Map<string, IssuedRun> } {
    const runs = new Map<string, IssuedRun>();
    const cur = new Map<string, string>();
    const gap = new Map<string, number>();
    return {
        runs,
        async issue(run) {
            const k = `${run.gameId}:${run.mbId}`;
            const last = gap.get(k);
            if (last !== undefined && clock() - last < START_GAP_MS) return 'rate_limited';
            gap.set(k, clock());
            runs.set(run.runId, run);
            cur.set(k, run.runId);
            return 'ok';
        },
        async take(gameId, mbId, runId) {
            const run = runs.get(runId);
            if (!run || run.mbId !== mbId || run.gameId !== gameId) return null;
            runs.delete(runId);
            const k = `${gameId}:${mbId}`;
            if (cur.get(k) !== runId) return null;
            cur.delete(k);
            return run;
        }
    };
}

interface Fake {
    deps: RankingDeps;
    saved: RunRecord[];
    runs: ReturnType<typeof memoryRuns>;
    advance(ms: number): void;
    store: {
        ready: boolean;
        missing: boolean;
        rows: BoardRow[];
        topCalls: Array<{ week: string | null; higherIsBetter: boolean }>;
        saveDirs: boolean[];
    };
}

function fake(seeds: number[] = [12345]): Fake {
    let now = Date.UTC(2026, 9, 15, 3, 0, 0);
    let n = 0;
    const saved: RunRecord[] = [];
    const store = {
        ready: true,
        missing: false,
        rows: [] as BoardRow[],
        topCalls: [] as Array<{ week: string | null; higherIsBetter: boolean }>,
        saveDirs: [] as boolean[]
    };
    const runs = memoryRuns(() => now);
    const deps: RankingDeps = {
        runs,
        store: {
            async tablesReady() {
                return store.ready;
            },
            async saveRun(rec, higherIsBetter): Promise<Standing> {
                if (store.missing) throw new TablesMissingError();
                saved.push(rec);
                store.saveDirs.push(higherIsBetter);
                return rec.flagged
                    ? { best: null, weekBest: null }
                    : { best: rec.score, weekBest: rec.score, rankWeek: 1 };
            },
            async topRows(_g, _v, week, higherIsBetter) {
                if (store.missing) throw new TablesMissingError();
                store.topCalls.push({ week, higherIsBetter });
                return store.rows;
            }
        },
        now: () => now,
        newRunId: () => `g_test${++n}`,
        newSeed: () => seeds[(n - 1 + seeds.length) % seeds.length] ?? 1
    };
    return {
        deps,
        saved,
        runs,
        store,
        advance(ms) {
            now += ms;
        }
    };
}

/** 엔진으로 실제 판을 만든다 — 내려오는 공을 따라가며 ±10px 흔드는 봇 */
function playBreakout(seed: number, ticks: number) {
    const g = createGame(seed);
    let r = seed >>> 0;
    for (let t = 0; t < ticks && !g.over; t++) {
        let target: Ball | null = null;
        for (const b of g.balls) if (b.sy > 0 && (!target || b.y > target.y)) target = b;
        target ??= g.balls[0] ?? null;
        const [nr, u] = mulberry32(r);
        r = nr;
        const base = target ? Math.round(target.x / SCALE) : START_X;
        step(g, { x: base + (u % 21) - 10, launch: g.attached && u % 3 === 0 });
    }
    return { score: g.score, ticks: g.tick, inputs: encodeLog(g.log) };
}

const breakout = getRankedGame('breakout')!;
/** 판 길이(틱)를 실제 시간(ms)으로 */
const ms = (ticks: number) => Math.ceil((ticks * 1000) / 60);

beforeEach(() => {
    clearBoardCache();
});

describe('등록부', () => {
    it('벽돌깨기는 높을수록 위, 변형 없음', () => {
        expect(breakout.higherIsBetter).toBe(true);
        expect(resolveGame('breakout', '')?.variant).toBe('');
        expect(resolveGame('breakout', 'x')).toBeNull();
        expect(resolveGame('nope', '')).toBeNull();
        expect(resolveGame('__proto__', '')).toBeNull();
    });
});

describe('기록 접수', () => {
    it('엔진으로 만든 실제 판은 재생 점수와 맞아 순위에 들어간다', async () => {
        const f = fake([777]);
        const s = await startRun(breakout, '', 'alice', f.deps);
        expect(s.kind).toBe('ok');
        if (s.kind !== 'ok') return;
        expect(s.seed).toBe(777);
        const play = playBreakout(s.seed, 6000);
        expect(play.score).toBeGreaterThan(0);
        f.advance(ms(play.ticks) + 500);
        const r = await finishRun(breakout, 'alice', { runId: s.runId, ...play }, f.deps);
        expect(r).toMatchObject({ kind: 'ok', accepted: true });
        expect(f.saved).toHaveLength(1);
        const rec = f.saved[0];
        expect(rec.flagged).toBe(false);
        expect(rec.flagReason).toBe('');
        expect(rec.score).toBe(play.score);
        expect(rec.ticks).toBe(play.ticks);
        expect(rec.seed).toBe(777);
        expect(rec.gameId).toBe('breakout');
        expect(rec.engineVer).toBe(breakout.engineVer);
        expect(JSON.parse(rec.inputsJson)).toEqual(play.inputs);
        expect(rec.weekStart).toBe('2026-10-12');
    });

    it('신고 점수를 부풀리면 score_mismatch 로 기록만 남는다', async () => {
        const f = fake([31337]);
        const s = await startRun(breakout, '', 'bob', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        const play = playBreakout(s.seed, 4000);
        f.advance(ms(play.ticks) + 500);
        const r = await finishRun(
            breakout,
            'bob',
            { runId: s.runId, ...play, score: play.score + 1000 },
            f.deps
        );
        expect(r).toMatchObject({ kind: 'ok', accepted: false });
        expect(f.saved[0].flagged).toBe(true);
        expect(f.saved[0].flagReason).toContain('score_mismatch');
    });

    it('남의 시드로 만든 기록도 발급 시드 재생값으로 판정', async () => {
        const f = fake([5]);
        const s = await startRun(breakout, '', 'bob', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        const play = playBreakout(999, 4000);
        f.advance(ms(play.ticks) + 500);
        const r = await finishRun(breakout, 'bob', { runId: s.runId, ...play }, f.deps);
        // 시드는 아이템 판정에만 쓰여 같은 입력이면 점수가 같을 수도 있다 — 판정 기준은 발급 시드 재생값
        const expected = breakout.replay(5, play.inputs, play.ticks, '');
        const ok = !expected.error && expected.score === play.score;
        expect(r).toMatchObject({ kind: 'ok', accepted: ok });
        expect(f.saved[0].seed).toBe(5);
        expect(f.saved[0].flagged).toBe(!ok);
    });

    it('시뮬레이션 시간이 서버 경과보다 길면 too_fast', async () => {
        const f = fake([42]);
        const s = await startRun(breakout, '', 'carol', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        const play = playBreakout(s.seed, 6000); // 100초 판
        f.advance(10_000); // 10초 만에 냄
        const r = await finishRun(breakout, 'carol', { runId: s.runId, ...play }, f.deps);
        expect(r).toMatchObject({ kind: 'ok', accepted: false });
        expect(f.saved[0].flagReason).toContain('too_fast');
        expect(f.saved[0].flagReason).not.toContain('score_mismatch');
    });

    it('너무 빠른 판은 재생하지 않는다(재생 비용을 실제 경과로 묶는다)', () => {
        const replaySpy = vi.fn(() => ({ score: 0, ticks: 0 }));
        const spyGame: RankedGame = { ...breakout, replay: replaySpy };
        const fast = checkClaim(spyGame, '', 1, { score: 5, ticks: 216000, inputs: {} }, 5000);
        expect(fast.reasons).toEqual(['too_fast']);
        expect(replaySpy).not.toHaveBeenCalled();
        checkClaim(spyGame, '', 1, { score: 0, ticks: 60, inputs: {} }, 5000);
        expect(replaySpy).toHaveBeenCalledTimes(1);
    });

    it('경과 × 1.05 + 2초 까지는 봐준다', () => {
        const ticks = 6000; // 100초
        const play = { score: 0, ticks, inputs: { m: '', l: '' } };
        const edge = Math.ceil((100_000 - 2000) / 1.05);
        expect(checkClaim(breakout, '', 1, play, edge).reasons).not.toContain('too_fast');
        expect(checkClaim(breakout, '', 1, play, edge - 100).reasons).toContain('too_fast');
    });

    it('모양이 틀린 기록·판 길이·점수는 각각 사유가 남는다', () => {
        expect(checkClaim(breakout, '', 1, { score: 0, ticks: -1, inputs: {} }, 0).reasons).toEqual(
            ['ticks_shape']
        );
        expect(
            checkClaim(breakout, '', 1, { score: 0, ticks: breakout.maxTicks + 1, inputs: {} }, 1e9)
                .reasons
        ).toEqual(['ticks_shape']);
        expect(
            checkClaim(breakout, '', 1, { score: 0, ticks: 10, inputs: 'x' }, 1e6).reasons
        ).toEqual(['bad_log']);
        expect(
            checkClaim(breakout, '', 1, { score: 1.5, ticks: 10, inputs: { m: '', l: '' } }, 1e6)
                .reasons
        ).toEqual(['score_shape']);
        // 공이 붙어 있지 않은데 쏜 기록
        const twice = encodeLog({ moves: [], launches: [0, 1] });
        expect(
            checkClaim(breakout, '', 1, { score: 0, ticks: 10, inputs: twice }, 1e6).reasons
        ).toEqual(['replay_launch-detached']);
    });

    it('같은 runId 는 한 번만 받는다', async () => {
        const f = fake([8]);
        const s = await startRun(breakout, '', 'dave', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        const play = playBreakout(s.seed, 600);
        f.advance(ms(play.ticks) + 500);
        const body = { runId: s.runId, ...play };
        expect((await finishRun(breakout, 'dave', body, f.deps)).kind).toBe('ok');
        expect((await finishRun(breakout, 'dave', body, f.deps)).kind).toBe('unknown_run');
        expect(f.saved).toHaveLength(1);
    });

    it('남의 runId 는 거부하고, 그 판은 주인이 그대로 낼 수 있다', async () => {
        const f = fake([9]);
        const s = await startRun(breakout, '', 'erin', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        const play = playBreakout(s.seed, 600);
        f.advance(ms(play.ticks) + 500);
        const body = { runId: s.runId, ...play };
        expect((await finishRun(breakout, 'mallory', body, f.deps)).kind).toBe('unknown_run');
        expect(f.saved).toHaveLength(0);
        expect((await finishRun(breakout, 'erin', body, f.deps)).kind).toBe('ok');
    });

    it('새 판을 받으면 이전 판은 낼 수 없다(동시 1판)', async () => {
        const f = fake([10, 11]);
        const a = await startRun(breakout, '', 'fay', f.deps);
        f.advance(START_GAP_MS);
        const b = await startRun(breakout, '', 'fay', f.deps);
        if (a.kind !== 'ok' || b.kind !== 'ok') throw new Error('start');
        const r = await finishRun(
            breakout,
            'fay',
            { runId: a.runId, score: 0, ticks: 0, inputs: { m: '', l: '' } },
            f.deps
        );
        expect(r.kind).toBe('unknown_run');
    });

    it('시작 간격 안에 다시 시작하면 rate_limited', async () => {
        const f = fake();
        expect((await startRun(breakout, '', 'gil', f.deps)).kind).toBe('ok');
        f.advance(START_GAP_MS - 1);
        expect((await startRun(breakout, '', 'gil', f.deps)).kind).toBe('rate_limited');
        f.advance(1);
        expect((await startRun(breakout, '', 'gil', f.deps)).kind).toBe('ok');
    });

    it('runId 모양이 틀리면 판을 찾지 않는다', async () => {
        const f = fake();
        const take = vi.spyOn(f.runs, 'take');
        for (const runId of [undefined, 1, '', 'a'.repeat(33), 'g_../x']) {
            const r = await finishRun(
                breakout,
                'h',
                { runId, score: 0, ticks: 0, inputs: null },
                f.deps
            );
            expect(r.kind).toBe('unknown_run');
        }
        expect(take).not.toHaveBeenCalled();
    });
});

describe('표가 없을 때', () => {
    it('start 는 준비 중 — 판을 발급하지 않는다', async () => {
        const f = fake();
        f.store.ready = false;
        expect((await startRun(breakout, '', 'ian', f.deps)).kind).toBe('not_ready');
        expect(f.runs.runs.size).toBe(0);
    });

    it('finish·leaderboard 는 준비 중', async () => {
        const f = fake([3]);
        const s = await startRun(breakout, '', 'jo', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        f.store.missing = true;
        const play = playBreakout(s.seed, 600);
        f.advance(ms(play.ticks) + 500);
        expect((await finishRun(breakout, 'jo', { runId: s.runId, ...play }, f.deps)).kind).toBe(
            'not_ready'
        );
        expect((await leaderboard(breakout, '', 'week', f.deps)).kind).toBe('not_ready');
        expect((await leaderboard(breakout, '', 'all', f.deps)).kind).toBe('not_ready');
    });
});

describe('순위표', () => {
    it('이번 주는 KST 월요일, 60초 동안은 다시 읽지 않는다', async () => {
        const f = fake();
        f.store.rows = [{ rank: 1, nickname: 'a', score: 10, achievedAt: '' }];
        const r1 = await leaderboard(breakout, '', 'week', f.deps);
        expect(r1).toMatchObject({ kind: 'ok', weekStart: '2026-10-12' });
        await leaderboard(breakout, '', 'week', f.deps);
        expect(f.store.topCalls).toHaveLength(1);
        f.advance(60_000);
        await leaderboard(breakout, '', 'week', f.deps);
        expect(f.store.topCalls).toHaveLength(2);
        await leaderboard(breakout, '', 'all', f.deps);
        expect(f.store.topCalls[2]).toEqual({ week: null, higherIsBetter: true });
    });
});

describe('낮을수록 좋은 게임(정렬 방향)', () => {
    const lowGame: RankedGame = {
        gameId: 'lowtest',
        variants: ['easy'],
        higherIsBetter: false,
        engineVer: 1,
        maxTicks: 1000,
        tickHz: 60,
        maxBodyBytes: 1024,
        replay: (_seed, inputs) => ({ score: Number(inputs) || 0, ticks: 0 })
    };

    it('저장·순위표 조회에 방향이 그대로 넘어간다', async () => {
        const f = fake();
        const s = await startRun(lowGame, 'easy', 'kim', f.deps);
        if (s.kind !== 'ok') throw new Error('start');
        f.advance(1000);
        const r = await finishRun(
            lowGame,
            'kim',
            { runId: s.runId, score: 37, ticks: 0, inputs: 37 },
            f.deps
        );
        expect(r).toMatchObject({ kind: 'ok', accepted: true });
        expect(f.saved[0].variant).toBe('easy');
        expect(f.store.saveDirs).toEqual([false]);
        await leaderboard(lowGame, 'easy', 'all', f.deps);
        expect(f.store.topCalls[0].higherIsBetter).toBe(false);
    });

    it('SQL — 낮을수록 좋으면 LEAST·「<」·오름차순, 높을수록 좋으면 GREATEST·「>」·내림차순', () => {
        const low = upsertSql('angple_game_best', false);
        expect(low).toContain('score = LEAST(score, VALUES(score))');
        expect(low).toContain('IF(VALUES(score) < score, VALUES(run_id), run_id)');
        expect(low).not.toContain('GREATEST');
        const high = upsertSql('angple_game_weekly', true);
        expect(high).toContain('score = GREATEST(score, VALUES(score))');
        expect(high).toContain('IF(VALUES(score) > score, VALUES(achieved_at), achieved_at)');
        expect(high).toContain('(game_id, variant, week_start, mb_id, score, run_id, achieved_at)');
        // score 는 맨 끝에 바꾼다(앞의 IF 들이 바뀌기 전 값을 비교하도록)
        expect(high.lastIndexOf('score = GREATEST')).toBeGreaterThan(
            high.lastIndexOf('achieved_at = IF')
        );

        expect(topSql(false, false)).toContain('ORDER BY t.score ASC, t.achieved_at ASC');
        expect(topSql(true, true)).toContain('ORDER BY t.score DESC, t.achieved_at ASC');
        expect(topSql(true, true)).toContain('FROM angple_game_weekly t');
        expect(topSql(false, true)).toContain('FROM angple_game_best t');
        expect(topSql(false, true)).toContain("m.mb_leave_date = '' AND m.mb_intercept_date = ''");
        expect(aheadSql(false)).toContain('w.score < ?');
        expect(aheadSql(true)).toContain('w.score > ?');
    });
});

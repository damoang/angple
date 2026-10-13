/**
 * 뱀 게임 기록 — 화면에서 모은 입력 기록이 서버 재연과 같은 점수를 내는지,
 * 시작·제출 요청이 서버 형식대로 나가고 실패하면 null(로컬 모드)인지, 최고 점수 저장.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    DIR_DOWN,
    DIR_LEFT,
    DIR_RIGHT,
    DIR_UP,
    createGame,
    mulberry32,
    replay,
    stepRecorded,
    type SnakeInput
} from './engine';
import {
    SNAKE_BEST_KEY,
    buildSnakeFinishBody,
    finishSnakeRun,
    loadLocalBest,
    saveLocalBest,
    startSnakeRun
} from './record';
import { STACK_API_BASE } from '$lib/games/stack/solo-record';
import { fetchLeaderboard } from '$lib/games/stack/leaderboard';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/** 아무렇게나 누르는 사람 — 반대 방향·같은 방향도 섞어 누른다(화면은 규칙대로 거른다) */
function mash(seed: number, presses: number) {
    const g = createGame(seed);
    const inputs: SnakeInput[] = [];
    let r = seed ^ 0x9e3779b9;
    let want: number = g.dir;
    for (let i = 0; i < presses && !g.over; i++) {
        const [next, u] = mulberry32(r);
        r = next;
        if (u % 3 === 0) want = [DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT][u % 4];
        stepRecorded(g, inputs, want);
    }
    while (!g.over) stepRecorded(g, inputs, g.dir);
    return { g, inputs };
}

describe('화면 입력 기록 → 재연', () => {
    it('화면에서 모은 기록은 재연하면 같은 점수·틱·시간이 나온다', () => {
        for (const seed of [1, 2, 3, 42, 2026, 0xffffffff]) {
            const { g, inputs } = mash(seed, 500);
            const r = replay(seed, inputs);
            expect(r.ok).toBe(true);
            expect(r.score).toBe(g.score);
            expect(r.ticks).toBe(g.tick);
            expect(r.simMs).toBe(g.simMs);
            expect(r.reason).toBe(g.reason);
        }
    });

    it('반대 방향 누름은 기록에 남지 않는다', () => {
        const g = createGame(1);
        const inputs: SnakeInput[] = [];
        stepRecorded(g, inputs, DIR_LEFT);
        stepRecorded(g, inputs, DIR_RIGHT);
        expect(inputs).toEqual([]);
        stepRecorded(g, inputs, DIR_UP);
        expect(inputs).toEqual([[2, DIR_UP]]);
    });

    it('점수를 부풀리면 재연 점수와 다르다', () => {
        const { g, inputs } = mash(7, 300);
        expect(replay(7, inputs).score).toBe(g.score);
        expect(replay(7, inputs).score).not.toBe(g.score + 1);
    });
});

describe('뱀 기록 요청', () => {
    it('start: 토큰을 헤더에 실어 POST 하고 runId·seed 를 돌려준다', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(200, { runId: 'r_1', seed: 123 }));
        const run = await startSnakeRun(async () => 'tok', { fetch: fetchMock as typeof fetch });
        expect(run).toEqual({ runId: 'r_1', seed: 123 });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${STACK_API_BASE}/snake/start`);
        expect(init.method).toBe('POST');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    });

    it('start: 토큰이 없거나 실패·이상한 응답이면 null', async () => {
        const ok = vi.fn(async () => jsonResponse(200, { runId: 'r', seed: 1 }));
        expect(await startSnakeRun(async () => null, { fetch: ok as typeof fetch })).toBeNull();
        expect(ok).not.toHaveBeenCalled();
        const limited = vi.fn(async () => jsonResponse(429, { error: 'rate_limited' }));
        expect(await startSnakeRun(async () => 't', { fetch: limited as typeof fetch })).toBeNull();
        const bad = vi.fn(async () => jsonResponse(200, { runId: 'r', seed: 2 ** 32 }));
        expect(await startSnakeRun(async () => 't', { fetch: bad as typeof fetch })).toBeNull();
        const broken = vi.fn(async () => {
            throw new Error('network');
        });
        expect(await startSnakeRun(async () => 't', { fetch: broken as typeof fetch })).toBeNull();
    });

    it('start: 시간 안에 답이 없으면 null', async () => {
        vi.useFakeTimers();
        try {
            const hang = vi.fn(
                (...args: unknown[]) =>
                    new Promise<Response>((_resolve, reject) => {
                        const init = args[1] as RequestInit | undefined;
                        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                    })
            );
            const p = startSnakeRun(async () => 't', {
                fetch: hang as unknown as typeof fetch,
                timeoutMs: 3000
            });
            await vi.advanceTimersByTimeAsync(3001);
            expect(await p).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('finish: 입력 기록·점수를 보내고 최고 기록·주간 순위를 돌려준다', async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse(200, { accepted: true, best: 40, weekBest: 30, rankWeek: 2 })
        );
        const inputs: SnakeInput[] = [
            [0, DIR_UP],
            [4, DIR_LEFT]
        ];
        const res = await finishSnakeRun('r_1', inputs, 3, async () => 't', {
            fetch: fetchMock as typeof fetch
        });
        expect(res).toEqual({ accepted: true, best: 40, weekBest: 30, rankWeek: 2 });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${STACK_API_BASE}/snake/finish`);
        expect(JSON.parse(String(init.body))).toEqual({ runId: 'r_1', inputs, score: 3 });
    });

    it('finish: 검사 실패는 accepted=false, 서버 오류는 null', async () => {
        const flagged = vi.fn(async () =>
            jsonResponse(200, { accepted: false, best: 10, weekBest: 0 })
        );
        expect(
            await finishSnakeRun('r', [], 0, async () => 't', { fetch: flagged as typeof fetch })
        ).toEqual({ accepted: false, best: 10, weekBest: 0 });
        const conflict = vi.fn(async () => jsonResponse(409, { error: 'unknown_run' }));
        expect(
            await finishSnakeRun('r', [], 0, async () => 't', { fetch: conflict as typeof fetch })
        ).toBeNull();
    });

    it('finish 본문은 입력 기록의 복사본이다', () => {
        const inputs: SnakeInput[] = [[1, DIR_UP]];
        const body = buildSnakeFinishBody('r', inputs, 0);
        inputs[0][1] = DIR_DOWN;
        expect(body.inputs).toEqual([[1, DIR_UP]]);
    });
});

describe('내 최고 점수(브라우저)', () => {
    it('저장한 값을 읽는다', () => {
        const map = new Map<string, string>();
        const storage = {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => void map.set(k, v)
        };
        expect(loadLocalBest(storage)).toBe(0);
        saveLocalBest(17, storage);
        expect(map.get(SNAKE_BEST_KEY)).toBe('17');
        expect(loadLocalBest(storage)).toBe(17);
        map.set(SNAKE_BEST_KEY, 'abc');
        expect(loadLocalBest(storage)).toBe(0);
    });

    it('저장소가 막혀 있어도 throw 하지 않는다', () => {
        const blocked = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            }
        };
        expect(loadLocalBest(blocked)).toBe(0);
        expect(() => saveLocalBest(3, blocked)).not.toThrow();
    });
});

describe('뱀 랭킹 불러오기', () => {
    it('snake_week·snake_all 보드를 같은 점수판 경로로 부른다', async () => {
        const rows = [{ rank: 1, nickname: '뱀왕', score: 57, achievedAt: '2026-10-12T00:00:01+09:00' }];
        const fetchFn = vi.fn<typeof fetch>(async () =>
            jsonResponse(200, { board: 'snake_week', weekStart: '2026-10-12', rows })
        );
        const week = await fetchLeaderboard('snake_week', { fetchFn });
        expect(week.rows).toEqual(rows);
        expect(week.weekStart).toBe('2026-10-12');
        expect(fetchFn).toHaveBeenCalledWith(
            `${STACK_API_BASE}/leaderboard?board=snake_week`,
            undefined
        );
        await fetchLeaderboard('snake_all', { fresh: true, fetchFn });
        expect(fetchFn).toHaveBeenLastCalledWith(`${STACK_API_BASE}/leaderboard?board=snake_all`, {
            cache: 'no-cache'
        });
    });
});

/**
 * 앙쌓기 혼자하기 기록 — 엔진에서 모은 값이 서버 검사식(soloClaimCheck)을 통과하는지,
 * 시작·제출 요청이 서버 형식대로 나가고 실패하면 null(로컬 모드)인지 본다.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    IN_CW,
    IN_HARD,
    IN_LEFT,
    IN_RIGHT,
    IN_SOFT,
    TICK_MS,
    createGame,
    step,
    type Game
} from './engine';
import { soloClaimCheck } from './versus';
import {
    STACK_API_BASE,
    buildFinishBody,
    buildSoloClaim,
    createSoloTracker,
    finishSoloRun,
    startSoloRun,
    trackStep,
    type SoloTracker
} from './solo-record';

/** 스크립트 입력으로 한 판을 끝까지(또는 maxTicks 까지) 돌린다 */
function play(
    seed: number,
    script: (t: number) => number,
    maxTicks = 30000
): { g: Game; t: SoloTracker } {
    const g = createGame(seed);
    const t = createSoloTracker();
    for (let i = 1; i <= maxTicks && !g.over; i++) trackStep(t, step(g, script(i)));
    return { g, t };
}

const scripts: Array<(t: number) => number> = [
    (t) => {
        if (t % 37 === 0) return IN_HARD;
        if (t % 11 === 0) return IN_CW;
        if (t % 7 === 0) return IN_LEFT;
        if (t % 5 === 0) return IN_RIGHT;
        return t % 3 === 0 ? IN_SOFT : 0;
    },
    // 하드 드롭만 — 낙하 점수가 큰 판
    (t) => (t % 9 === 0 ? IN_HARD : t % 4 === 0 ? IN_LEFT | IN_SOFT : 0),
    // 손 놓은 판 — 중력만
    () => 0,
    // 소프트 드롭을 계속 누른 판
    (t) => (t % 13 === 0 ? IN_RIGHT : t % 17 === 0 ? IN_CW : IN_SOFT)
];

describe('혼자하기 기록 수집', () => {
    it('엔진에서 모은 기록은 서버 검사식을 통과한다', () => {
        let sawClears = false;
        for (const [i, script] of scripts.entries()) {
            for (const seed of [1, 2024, 0xdeadbeef]) {
                const { g, t } = play(seed + i, script);
                if (t.clears.length > 0) sawClears = true;
                const claim = buildSoloClaim(g, t);
                const res = soloClaimCheck(claim, g.tick * TICK_MS);
                expect(res.reasons, `script ${i} seed ${seed}`).toEqual([]);
            }
        }
        expect(sawClears).toBe(true);
    });

    it('진행 중에 낸 기록도 통과한다 (다시 시작 전 상태)', () => {
        const { g, t } = play(77, scripts[0], 1500);
        expect(soloClaimCheck(buildSoloClaim(g, t), g.tick * TICK_MS).ok).toBe(true);
    });

    it('줄을 지운 사건만 clears 에 쌓이고 조각 수는 굳은 횟수다', () => {
        const t = createSoloTracker();
        trackStep(t, { dirty: true, locked: false, cleared: 0 });
        trackStep(t, { dirty: true, locked: true, cleared: 0 });
        trackStep(t, { dirty: true, locked: true, cleared: 2 });
        expect(t).toEqual({ pieces: 2, clears: [2] });
    });

    it('finish 본문은 서버 필드 이름 그대로다', () => {
        const { g, t } = play(5, scripts[1]);
        const body = buildFinishBody('r_x', buildSoloClaim(g, t));
        expect(Object.keys(body).sort()).toEqual(
            ['clears', 'level', 'lines', 'pieces', 'runId', 'score', 'ticks'].sort()
        );
        expect(body.runId).toBe('r_x');
        expect(body.ticks).toBe(g.tick);
    });

    it('기록 값은 복사본이다 (이후 수집이 보낸 값을 바꾸지 않는다)', () => {
        const g = createGame(1);
        const t = createSoloTracker();
        t.clears.push(1);
        const claim = buildSoloClaim(g, t);
        t.clears.push(2);
        expect(claim.clears).toEqual([1]);
    });
});

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

describe('혼자하기 기록 요청', () => {
    it('start: 토큰을 헤더에 실어 POST 하고 runId·seed 를 돌려준다', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(200, { runId: 'r_1', seed: 123 }));
        const run = await startSoloRun(async () => 'tok', { fetch: fetchMock as typeof fetch });
        expect(run).toEqual({ runId: 'r_1', seed: 123 });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${STACK_API_BASE}/solo/start`);
        expect(init.method).toBe('POST');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    });

    it('start: 토큰이 없거나 실패·이상한 응답이면 null', async () => {
        const ok = vi.fn(async () => jsonResponse(200, { runId: 'r', seed: 1 }));
        expect(await startSoloRun(async () => null, { fetch: ok as typeof fetch })).toBeNull();
        expect(ok).not.toHaveBeenCalled();

        const limited = vi.fn(async () => jsonResponse(429, { error: 'rate_limited' }));
        expect(await startSoloRun(async () => 't', { fetch: limited as typeof fetch })).toBeNull();

        const bad = vi.fn(async () => jsonResponse(200, { runId: '', seed: -1 }));
        expect(await startSoloRun(async () => 't', { fetch: bad as typeof fetch })).toBeNull();

        const broken = vi.fn(async () => {
            throw new Error('network');
        });
        expect(await startSoloRun(async () => 't', { fetch: broken as typeof fetch })).toBeNull();
    });

    it('start: 시간 안에 답이 없으면 null', async () => {
        vi.useFakeTimers();
        try {
            const hang = vi.fn(
                (...args: unknown[]) =>
                    new Promise<Response>((resolve, reject) => {
                        const init = args[1] as RequestInit | undefined;
                        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                        // 응답은 오지 않는다 (resolve 를 부르지 않음)
                        void resolve;
                    })
            );
            const p = startSoloRun(async () => 't', {
                fetch: hang as unknown as typeof fetch,
                timeoutMs: 3000
            });
            await vi.advanceTimersByTimeAsync(3001);
            expect(await p).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('401 이면 새 토큰으로 한 번 더 시도한다', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(401, { error: 'unauthorized' }))
            .mockResolvedValueOnce(jsonResponse(200, { runId: 'r_2', seed: 9 }));
        const getToken = vi.fn(async (fresh: boolean) => (fresh ? 'new' : 'old'));
        const run = await startSoloRun(getToken, { fetch: fetchMock as typeof fetch });
        expect(run).toEqual({ runId: 'r_2', seed: 9 });
        expect(getToken.mock.calls.map((c) => c[0])).toEqual([false, true]);
        const init = fetchMock.mock.calls[1][1] as RequestInit;
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer new');
    });

    it('finish: 본문을 보내고 최고 기록·주간 순위를 돌려준다', async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse(200, { accepted: true, best: 900, weekBest: 800, rankWeek: 3 })
        );
        const claim = { score: 10, lines: 0, level: 1, ticks: 100, pieces: 2, clears: [] };
        const res = await finishSoloRun('r_1', claim, async () => 't', {
            fetch: fetchMock as typeof fetch
        });
        expect(res).toEqual({ accepted: true, best: 900, weekBest: 800, rankWeek: 3 });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${STACK_API_BASE}/solo/finish`);
        expect(JSON.parse(String(init.body))).toEqual({ runId: 'r_1', ...claim });
    });

    it('finish: 검사 실패(accepted=false)는 그대로, 순위 없음·서버 오류는 구분한다', async () => {
        const flagged = vi.fn(async () =>
            jsonResponse(200, { accepted: false, best: 0, weekBest: 0 })
        );
        const claim = { score: 0, lines: 0, level: 1, ticks: 1, pieces: 0, clears: [] };
        expect(
            await finishSoloRun('r', claim, async () => 't', { fetch: flagged as typeof fetch })
        ).toEqual({ accepted: false, best: 0, weekBest: 0 });

        const conflict = vi.fn(async () =>
            jsonResponse(409, { accepted: false, error: 'unknown_run' })
        );
        expect(
            await finishSoloRun('r', claim, async () => 't', { fetch: conflict as typeof fetch })
        ).toBeNull();
    });
});

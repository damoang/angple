/**
 * 벽돌깨기 입력 기록 압축 — 왕복(엔진이 만든 실제 판), 모양 오류 거부, 크기 상한,
 * 그리고 최대 길이(1시간) 판을 서버 재생 경로로 돌리는 데 걸린 시간을 로그로 남긴다(CI 로그에서 읽는다).
 */
import { describe, it, expect } from 'vitest';
import {
    MAX_ANGLE,
    MAX_BALLS,
    MAX_TICKS,
    SCALE,
    START_X,
    createGame,
    mulberry32,
    replay,
    step,
    type Ball,
    type Game
} from './engine';
import { decodeLog, encodeLog } from './log-codec';
import { BREAKOUT_RANKED_MAX_TICKS } from './ranked';
import { BREAKOUT_MAX_BODY_BYTES, getRankedGame } from '$lib/server/game-ranking/registry';

/**
 * 봇 — 내려오는 공 중 가장 낮은 것을 따라간다. jitter>0 이면 매 틱 ±jitter px 흔든다(기록이 매 틱 생긴다).
 * 공이 붙어 있으면 곧바로 쏜다.
 */
function botRun(seed: number, ticks: number, jitter = 0): Game {
    const g = createGame(seed);
    let r = (seed ^ 0x9e3779b9) >>> 0;
    for (let t = 0; t < ticks && !g.over; t++) {
        let target: Ball | null = null;
        for (const b of g.balls) {
            if (b.sy > 0 && (!target || b.y > target.y)) target = b;
        }
        target ??= g.balls[0] ?? null;
        const base = target ? Math.round(target.x / SCALE) : START_X;
        let x = base;
        if (jitter > 0) {
            const [nr, u] = mulberry32(r);
            r = nr;
            x = base + (u % (2 * jitter + 1)) - jitter;
        }
        step(g, { x, launch: g.attached });
    }
    return g;
}

/** 매 틱 막대 목표가 바뀌는 판(기록 크기 최악) — 따라가되 짝수·홀수 틱을 1px 씩 엇갈린다 */
function worstCaseRun(seed: number): Game {
    const g = createGame(seed);
    for (let t = 0; t < MAX_TICKS && !g.over; t++) {
        let target: Ball | null = null;
        for (const b of g.balls) {
            if (b.sy > 0 && (!target || b.y > target.y)) target = b;
        }
        target ??= g.balls[0] ?? null;
        const base = target ? Math.round(target.x / SCALE) : START_X;
        const x = base + (t & 1 ? 1 : -1);
        step(g, { x, launch: g.attached });
    }
    return g;
}

describe('입력 기록 압축', () => {
    it('엔진이 만든 판을 압축했다 풀면 기록이 똑같고, 다시 돌리면 같은 점수다', () => {
        for (const seed of [1, 42, 2024, 0xdeadbeef]) {
            const g = botRun(seed, 20000, 20);
            const enc = encodeLog(g.log);
            const back = decodeLog(JSON.parse(JSON.stringify(enc)), g.tick);
            expect(back).toEqual(g.log);
            const res = replay(seed, back!, g.tick);
            expect(res.ok).toBe(true);
            expect(res.game.score).toBe(g.score);
            expect(res.game.score).toBeGreaterThan(0);
        }
    });

    it('틱 간격이 길거나(가변 길이) x 가 양 끝이어도 왕복한다', () => {
        const log = {
            moves: [0, 0, 1, 360, 8, 5, 9, 6, 16, 7, 1000, 200, 150000, 180, 215999, 359],
            launches: [0, 31, 32, 64, 5000, 215998]
        };
        const back = decodeLog(encodeLog(log), MAX_TICKS);
        expect(back).toEqual(log);
    });

    it('빈 기록도 왕복한다', () => {
        const back = decodeLog(encodeLog({ moves: [], launches: [] }), 10);
        expect(back).toEqual({ moves: [], launches: [] });
    });

    it('모양이 틀리면 null', () => {
        expect(decodeLog(null, 100)).toBeNull();
        expect(decodeLog({ m: 1, l: '' }, 100)).toBeNull();
        expect(decodeLog({ m: 'A', l: '' }, 100)).toBeNull(); // 홀수 글자
        expect(decodeLog({ m: 'A!', l: '' }, 100)).toBeNull(); // 알파벳 밖
        expect(decodeLog({ m: 'Fp', l: '' }, 100)).toBeNull(); // x=361
        expect(decodeLog({ m: '', l: 'g' }, 100)).toBeNull(); // 이어지는 글자가 없음
        expect(decodeLog({ m: '', l: '________' }, 100)).toBeNull(); // 너무 긴 가변 정수
        // maxTick 을 넘는 틱
        expect(decodeLog(encodeLog({ moves: [101, 10], launches: [] }), 100)).toBeNull();
        expect(decodeLog(encodeLog({ moves: [], launches: [101] }), 100)).toBeNull();
    });

    it('매 틱 바뀌는 기록은 틱당 정확히 2글자', () => {
        const n = 1000;
        const moves: number[] = [];
        for (let t = 0; t < n; t++) moves.push(t, t & 1 ? 100 : 101);
        expect(encodeLog({ moves, launches: [] }).m.length).toBe(2 * n);
    });

    it('최대 길이(1시간) 판 — 서버 재생 시간·본문 크기를 로그로 남긴다', () => {
        const seed = 20261015;
        const t0 = performance.now();
        const g = worstCaseRun(seed);
        const playMs = performance.now() - t0;
        const enc = encodeLog(g.log);
        const body = JSON.stringify({
            runId: 'g_0123456789abcdefghij',
            score: g.score,
            ticks: g.tick,
            inputs: enc
        });
        const bodyBytes = Buffer.byteLength(body, 'utf8');

        const game = getRankedGame('breakout')!;
        const parsed = JSON.parse(body) as { inputs: unknown };
        const t1 = performance.now();
        const out = game.replay(seed, parsed.inputs, g.tick, '');
        const replayMs = performance.now() - t1;

        const line =
            `[breakout-replay-timing] ticks=${g.tick} reason=${g.reason || 'none'} score=${g.score}` +
            ` moves=${g.log.moves.length / 2} launches=${g.log.launches.length}` +
            ` movesChars=${enc.m.length} bodyBytes=${bodyBytes} maxBody=${BREAKOUT_MAX_BODY_BYTES}` +
            ` playMs=${playMs.toFixed(1)} replayMs=${replayMs.toFixed(1)}`;
        // CI 로그에서 읽는다 — 리포터가 console 을 감춰도 보이게 stdout 에도 직접 쓴다
        console.log(line);
        process.stdout.write(`${line}\n`);

        expect(g.tick).toBe(MAX_TICKS);
        expect(g.reason).toBe('limit');
        expect(out.error).toBeUndefined();
        expect(out.score).toBe(g.score);
        expect(out.ticks).toBe(g.tick);
        // 기록은 판 길이 × 2글자 이하
        expect(enc.m.length).toBeLessThanOrEqual(2 * MAX_TICKS);

        // 순위 판 상한(20분)까지 자른 같은 판 — 본문이 상한 안에 든다
        const cut = BREAKOUT_RANKED_MAX_TICKS;
        const moves: number[] = [];
        for (let k = 0; k < g.log.moves.length && g.log.moves[k] < cut; k += 2) {
            moves.push(g.log.moves[k], g.log.moves[k + 1]);
        }
        const launches = g.log.launches.filter((t) => t < cut);
        const cutBody = JSON.stringify({
            runId: 'g_0123456789abcdefghij',
            score: g.score,
            ticks: cut,
            inputs: encodeLog({ moves, launches })
        });
        const cutBytes = Buffer.byteLength(cutBody, 'utf8');
        process.stdout.write(`[breakout-ranked-body] ticks=${cut} bodyBytes=${cutBytes}\n`);
        expect(cutBytes).toBeLessThanOrEqual(BREAKOUT_MAX_BODY_BYTES);
        expect(2 * cut + 1024).toBeLessThanOrEqual(BREAKOUT_MAX_BODY_BYTES);
    }, 180_000);

    it('최악의 재생 비용 — 공 8개·최고 속력으로 1시간(시험용으로 상태를 직접 채운다)', () => {
        // 입력만으로는 공 8개를 1시간 내내 유지할 수 없어서, 매 틱 공을 8개로 다시 채우고
        // 속력을 상한에 고정한다. step() 을 도는 비용 = 같은 상태의 재생 비용(재생도 step() 반복).
        const g = createGame(7);
        g.loop = 50; // 속력 상한
        const fill = () => {
            while (g.balls.length < MAX_BALLS) {
                const k = g.nextBallId++;
                const x = (20 + ((k * 37) % 320)) * SCALE;
                const y = (300 + ((k * 53) % 150)) * SCALE;
                g.balls.push({
                    id: k,
                    x,
                    y,
                    px: x,
                    py: y,
                    a: 1 + (k % MAX_ANGLE),
                    sx: k & 1 ? 1 : -1,
                    sy: -1,
                    idle: 0
                });
            }
            g.attached = false;
        };
        fill();
        let ballTicks = 0;
        const t0 = performance.now();
        for (let t = 0; t < MAX_TICKS; t++) {
            let target: Ball | null = null;
            for (const b of g.balls) {
                if (b.sy > 0 && (!target || b.y > target.y)) target = b;
            }
            const x = target ? Math.round(target.x / SCALE) : START_X;
            g.slowTicks = 0;
            ballTicks += g.balls.length;
            step(g, { x, launch: false });
            if (g.over && g.tick < MAX_TICKS) {
                g.over = false;
                g.reason = '';
                g.lives = 3;
            }
            if (g.attached || g.balls.length < MAX_BALLS) fill();
        }
        const ms = performance.now() - t0;
        const cap = getRankedGame('breakout')!.maxTicks;
        const line =
            `[breakout-replay-worst] ticks=${MAX_TICKS} avgBalls=${(ballTicks / MAX_TICKS).toFixed(2)}` +
            ` ms=${ms.toFixed(1)} usPerTick=${((ms * 1000) / MAX_TICKS).toFixed(2)}` +
            ` rankedMaxTicks=${cap} msAtCap=${((ms * cap) / MAX_TICKS).toFixed(1)}`;
        console.log(line);
        process.stdout.write(`${line}\n`);
        expect(ballTicks / MAX_TICKS).toBeGreaterThan(MAX_BALLS - 1);
    }, 180_000);
});

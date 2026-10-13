/**
 * 벽돌깨기 엔진 테스트 — 결정성·재연, 충돌(모서리·이음매·옆면·빠른 공), 막대 각도,
 * 아이템, 스테이지 클리어·반복, 목숨, 점수·콤보, 입력 기록
 */
import { describe, it, expect } from 'vitest';
import {
    BALL_R,
    BASE_SPEED,
    BRICK_COLS,
    BRICK_ROWS,
    IDLE_NUDGE_TICKS,
    LOOP_SPEED_STEP,
    MAX_BALLS,
    MAX_LIVES,
    MAX_SPEED,
    MAX_TICKS,
    PADDLE_W,
    PADDLE_WIDE_W,
    SCALE,
    SLOW_TICKS,
    START_LIVES,
    START_X,
    WIDE_TICKS,
    FIELD_W,
    applyItem,
    ballSpeed,
    brickRect,
    circleHitsRect,
    createGame,
    loadStage,
    mulberry32,
    replay,
    step,
    type Ball,
    type Game,
    type GameLog,
    type StepEvent
} from './engine';
import {
    BRICK_HARD2,
    BRICK_HARD3,
    BRICK_NONE,
    BRICK_NORMAL,
    BRICK_SOLID,
    DROP_PERCENT,
    FULL_LIFE_POINTS,
    ITEM_LIFE,
    ITEM_MULTI,
    ITEM_POINTS,
    ITEM_SLOW,
    ITEM_WIDE,
    LIFE_BONUS,
    STAGE_BONUS,
    STAGES,
    brickHp,
    hitPoints,
    isBreakable
} from './stages';

const S = SCALE;

/** 판을 비우고(벽돌 없음) 남은 벽돌 수를 다시 센다 */
function blank(g: Game): void {
    g.kinds.fill(BRICK_NONE);
    g.hp.fill(0);
    g.remaining = 0;
}

function setBrick(g: Game, col: number, row: number, kind: number): void {
    const i = row * BRICK_COLS + col;
    g.kinds[i] = kind;
    g.hp[i] = brickHp(kind);
    g.remaining = g.kinds.filter(isBreakable).length;
}

/** 클리어가 되지 않도록 왼쪽 위 구석에 벽돌 하나를 둔다 */
function sentinel(g: Game): void {
    setBrick(g, 0, 0, BRICK_HARD3);
}

/** 공 하나를 (x,y) px 에 날아가는 상태로 둔다 */
function fly(g: Game, x: number, y: number, a: number, sx: number, sy: number): Ball {
    const b: Ball = { id: 99, x: x * S, y: y * S, px: x * S, py: y * S, a, sx, sy, idle: 0 };
    g.attached = false;
    g.balls = [b];
    return b;
}

/** 조건이 맞을 때까지 막대를 px 에 두고 진행 — 그동안 일어난 일을 모은다 */
function runUntil(g: Game, px: number, done: (ev: StepEvent[]) => boolean, max = 600): StepEvent[] {
    const all: StepEvent[] = [];
    for (let t = 0; t < max && !g.over; t++) {
        const ev = step(g, { x: px });
        all.push(...ev);
        if (done(ev)) break;
    }
    return all;
}

const has = (type: StepEvent['type']) => (ev: StepEvent[]) => ev.some((e) => e.type === type);

/** 공 하나라도 살아 있는 벽돌과 겹치는가 */
function overlapsBrick(g: Game): boolean {
    for (const b of g.balls) {
        for (let r = 0; r < BRICK_ROWS; r++) {
            for (let c = 0; c < BRICK_COLS; c++) {
                if (g.kinds[r * BRICK_COLS + c] === BRICK_NONE) continue;
                const [l, t, rt, bt] = brickRect(c, r);
                if (circleHitsRect(b.x, b.y, l, t, rt, bt)) return true;
            }
        }
    }
    return false;
}

/**
 * 봇 — 내려오는 공 중 가장 낮은 것을 따라가되 매 틱 ±jitter px 흔들고, 공이 붙어 있으면 가끔 쏜다.
 * check 가 있으면 매 틱 뒤에 불러 불변식을 검사한다.
 */
function botRun(
    seed: number,
    ticks: number,
    opts: { jitter?: number; prep?: (g: Game) => void; check?: (g: Game) => void } = {}
): Game {
    const g = createGame(seed);
    opts.prep?.(g);
    const jitter = opts.jitter ?? 20;
    let r = (seed ^ 0x9e3779b9) >>> 0;
    for (let t = 0; t < ticks && !g.over; t++) {
        let target: Ball | null = null;
        for (const b of g.balls) {
            if (b.sy > 0 && (!target || b.y > target.y)) target = b;
        }
        target ??= g.balls[0] ?? null;
        const [nr, u] = mulberry32(r);
        r = nr;
        const base = target ? Math.round(target.x / S) : START_X;
        const x = base + (u % (2 * jitter + 1)) - jitter;
        step(g, { x, launch: g.attached && u % 5 === 0 });
        opts.check?.(g);
    }
    return g;
}

describe('스테이지 표', () => {
    it('다섯 스테이지, 줄마다 10칸, 10줄 이하, 알려진 글자만, 깨지는 벽돌이 있다', () => {
        expect(STAGES).toHaveLength(5);
        for (const rows of STAGES) {
            expect(rows.length).toBeLessThanOrEqual(BRICK_ROWS);
            for (const line of rows) {
                expect(line).toHaveLength(BRICK_COLS);
                expect(line).toMatch(/^[.123#]+$/);
            }
            expect(rows.join('')).toMatch(/[123]/);
        }
    });

    it('안 깨지는 벽돌은 남은 벽돌 수에서 빠진다', () => {
        const g = createGame(1);
        for (let s = 0; s < STAGES.length; s++) {
            g.stage = s;
            loadStage(g);
            const want = STAGES[s].join('').replace(/[^123]/g, '').length;
            expect(g.remaining).toBe(want);
        }
    });
});

describe('새 판', () => {
    it('목숨 3, 1스테이지, 공은 막대 위에 붙어 있다', () => {
        const g = createGame(42);
        expect(g.lives).toBe(START_LIVES);
        expect(g.stage).toBe(0);
        expect(g.attached).toBe(true);
        expect(g.balls).toHaveLength(1);
        expect(g.paddleX).toBe(START_X * S);
        expect(g.remaining).toBeGreaterThan(0);
    });

    it('붙어 있는 공은 막대를 따라가고, 발사하면 위로 간다', () => {
        const g = createGame(1);
        step(g, { x: 100 });
        expect(g.balls[0].x).toBe(100 * S);
        const ev = step(g, { x: 100, launch: true });
        expect(ev.some((e) => e.type === 'launch')).toBe(true);
        expect(g.attached).toBe(false);
        const y0 = g.balls[0].y;
        step(g, { x: 100 });
        expect(g.balls[0].y).toBeLessThan(y0);
        // 막대가 왼쪽에 있으면 가운데 쪽(오른쪽)으로 쏜다
        expect(g.balls[0].sx).toBe(1);
    });
});

describe('결정성', () => {
    it('같은 seed + 같은 입력이면 상태가 똑같다', () => {
        for (const seed of [1, 7, 123456789, 0xdeadbeef]) {
            const a = botRun(seed, 8000);
            const b = botRun(seed, 8000);
            expect(JSON.stringify(a)).toBe(JSON.stringify(b));
            expect(a.score).toBeGreaterThan(0);
        }
    });

    it('기록으로 다시 돌리면(replay) 같은 판이 나온다', () => {
        for (const seed of [3, 99, 2024]) {
            const g = botRun(seed, 12000);
            const res = replay(seed, g.log, g.tick);
            expect(res.ok).toBe(true);
            expect(res.error).toBe('');
            const r = res.game;
            expect(r.tick).toBe(g.tick);
            expect(r.score).toBe(g.score);
            expect(JSON.stringify(r)).toBe(JSON.stringify(g));
        }
    });

    it('seed 가 다르면 아이템이 다르게 떨어진다', () => {
        const drops = (seed: number) => {
            const g = createGame(seed);
            const out: number[] = [];
            for (let k = 0; k < 40; k++) {
                const [s, u] = mulberry32(g.rng);
                g.rng = s;
                out.push(u % 100);
            }
            return out.join(',');
        };
        expect(drops(1)).not.toBe(drops(2));
        expect(drops(5)).toBe(drops(5));
    });

    it('엔진은 정수 좌표만 쓴다', () => {
        const g = botRun(11, 6000);
        for (const b of g.balls) {
            expect(Number.isInteger(b.x) && Number.isInteger(b.y)).toBe(true);
        }
        expect(Number.isInteger(g.paddleX)).toBe(true);
        expect(Number.isInteger(g.score)).toBe(true);
    });
});

describe('충돌', () => {
    it('모서리에 정확히 대각선으로 맞으면 가로·세로 둘 다 튕긴다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_HARD2);
        const [l, , , bt] = brickRect(4, 5);
        const b = fly(g, l / S - 20, bt / S + 20, 9, 1, -1);
        const ev = runUntil(g, 300, has('brick'), 60);
        expect(ev.some((e) => e.type === 'brick')).toBe(true);
        expect(b.sx).toBe(-1);
        expect(b.sy).toBe(1);
        expect(g.hp[5 * BRICK_COLS + 4]).toBe(1);
    });

    it('정확히 이음매 위에서 맞으면 번호가 작은 벽돌 하나만 맞는다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_NORMAL);
        setBrick(g, 5, 5, BRICK_NORMAL);
        const [, , rt, bt] = brickRect(4, 5);
        // 속력 1152·각도 1 이면 한 걸음에 가로 50·세로 573 단위 — 12번째 걸음에서 닿고,
        // 그 직전(11번째) 중심 x 가 정확히 이음매(rt)가 되도록 출발점을 잡는다
        const b = fly(g, (rt - 11 * 50) / S, bt / S + 30, 1, 1, -1);
        const ev = runUntil(g, 300, has('brick'), 60);
        const hits = ev.filter((e) => e.type === 'brick');
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatchObject({ col: 4, row: 5 });
        expect(g.kinds[5 * BRICK_COLS + 5]).toBe(BRICK_NORMAL);
        expect(b.sy).toBe(1);
    });

    it('두 벽돌의 이음매에 맞으면 한 개만 맞고 세로로만 튕긴다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_NORMAL);
        setBrick(g, 5, 5, BRICK_NORMAL);
        const [, , rt, bt] = brickRect(4, 5);
        const b = fly(g, rt / S - 1, bt / S + 30, 1, 1, -1);
        const ev = runUntil(g, 300, has('brick'), 60);
        expect(ev.filter((e) => e.type === 'brick')).toHaveLength(1);
        expect(b.sy).toBe(1);
        expect(b.sx).toBe(1);
    });

    it('옆면에 맞으면 가로로만 튕긴다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_HARD3);
        const [l, t] = brickRect(4, 5);
        const b = fly(g, l / S - 20, t / S + 4, 12, 1, 1);
        const ev = runUntil(g, 300, has('brick'), 60);
        expect(ev.some((e) => e.type === 'brick')).toBe(true);
        expect(b.sx).toBe(-1);
        expect(b.sy).toBe(1);
    });

    it('모서리를 어떤 각도로 스쳐도 공이 끼이지 않고 한 번에 두 번 넘게 맞히지 않는다', () => {
        for (let a = 1; a <= 12; a++) {
            for (let off = -12; off <= 12; off += 3) {
                const g = createGame(1);
                blank(g);
                sentinel(g);
                setBrick(g, 4, 5, BRICK_HARD3);
                g.hp[5 * BRICK_COLS + 4] = 99;
                const [l, , , bt] = brickRect(4, 5);
                const b = fly(g, l / S + off, bt / S + 40, a, 1, -1);
                let hits = 0;
                let still = 0;
                for (let k = 0; k < 40; k++) {
                    hits += step(g, { x: 300 }).filter((e) => e.type === 'brick').length;
                    still = b.x === b.px && b.y === b.py ? still + 1 : 0;
                    expect(still).toBeLessThan(2);
                    expect(overlapsBrick(g)).toBe(false);
                }
                expect(hits).toBeLessThanOrEqual(2);
            }
        }
    });

    it('안 깨지는 벽돌은 튕기기만 한다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_SOLID);
        const [, , , bt] = brickRect(4, 5);
        const b = fly(g, 160, bt / S + 30, 1, 1, -1);
        const ev = runUntil(g, 300, has('solid'), 60);
        expect(ev.some((e) => e.type === 'solid')).toBe(true);
        expect(b.sy).toBe(1);
        expect(g.kinds[5 * BRICK_COLS + 4]).toBe(BRICK_SOLID);
        expect(g.score).toBe(0);
    });

    it('가장 빠른 공도 벽돌 한 줄을 뚫고 지나가지 못한다', () => {
        for (let x = 12; x <= FIELD_W - 12; x += 7) {
            const g = createGame(1);
            g.loop = 20;
            blank(g);
            for (let c = 0; c < BRICK_COLS; c++) setBrick(g, c, 5, BRICK_HARD3);
            expect(ballSpeed(g)).toBe(MAX_SPEED);
            const [, t, , bt] = brickRect(0, 5);
            const b = fly(g, x, 400, 1, x < 180 ? 1 : -1, -1);
            let hit = false;
            for (let k = 0; k < 120 && !hit; k++) {
                hit = step(g, { x: 300 }).some((e) => e.type === 'brick');
                // 공 위쪽 끝이 줄 위로 넘어간 적이 없어야 한다
                expect(b.y + BALL_R * S).toBeGreaterThan(t);
                expect(overlapsBrick(g)).toBe(false);
            }
            expect(hit).toBe(true);
            expect(b.sy).toBe(1);
            expect(b.y).toBeGreaterThan(bt);
        }
    });

    it('빠른 공으로 오래 쳐도 공이 벽돌과 겹치거나 판 밖으로 나가지 않는다', () => {
        let ticks = 0;
        for (const seed of [5, 17]) {
            botRun(seed, 15000, {
                prep: (g) => {
                    g.loop = 20;
                },
                check: (g) => {
                    ticks++;
                    expect(overlapsBrick(g)).toBe(false);
                    for (const b of g.balls) {
                        expect(b.x).toBeGreaterThanOrEqual(BALL_R * S);
                        expect(b.x).toBeLessThanOrEqual((FIELD_W - BALL_R) * S);
                        expect(b.y).toBeGreaterThanOrEqual(BALL_R * S);
                    }
                }
            });
        }
        expect(ticks).toBeGreaterThan(1000);
    });

    it('오래 아무것도 못 맞히면 각도가 한 칸 바뀐다', () => {
        const g = createGame(1);
        const b = fly(g, 180, 300, 4, 1, -1);
        b.idle = IDLE_NUDGE_TICKS - 1;
        step(g, { x: 180 });
        expect(b.a).toBe(5);
        expect(b.idle).toBe(0);
    });
});

describe('막대', () => {
    function bounceAt(offset: number, sx: number): Ball {
        const g = createGame(1);
        sentinel(g);
        const b = fly(g, 180 + offset, 470, 1, sx, 1);
        const ev = runUntil(g, 180, has('paddle'), 120);
        expect(ev.some((e) => e.type === 'paddle')).toBe(true);
        return b;
    }

    it('가운데에 맞으면 거의 수직, 끝에 맞으면 비스듬히 튕긴다', () => {
        const mid = bounceAt(0, 1);
        expect(mid.sy).toBe(-1);
        expect(mid.a).toBeLessThanOrEqual(2);

        const right = bounceAt(PADDLE_W / 2, 1);
        expect(right.a).toBeGreaterThanOrEqual(11);
        expect(right.sx).toBe(1);

        const left = bounceAt(-PADDLE_W / 2, -1);
        expect(left.a).toBeGreaterThanOrEqual(11);
        expect(left.sx).toBe(-1);

        const quarter = bounceAt(PADDLE_W / 4, 1);
        expect(quarter.a).toBeGreaterThan(mid.a);
        expect(quarter.a).toBeLessThan(right.a);
    });

    it('막대에 맞으면 콤보가 끊긴다', () => {
        const g = createGame(1);
        g.combo = 5;
        fly(g, 180, 480, 1, 1, 1);
        runUntil(g, 180, has('paddle'), 60);
        expect(g.combo).toBe(0);
    });
});

describe('목숨', () => {
    it('공을 놓치면 목숨 1개를 잃고 공이 막대에 다시 붙는다', () => {
        const g = createGame(1);
        fly(g, 20, 480, 1, -1, 1);
        const ev = runUntil(g, 300, has('life-lost'));
        expect(ev.some((e) => e.type === 'life-lost')).toBe(true);
        expect(g.lives).toBe(START_LIVES - 1);
        expect(g.attached).toBe(true);
        expect(g.balls).toHaveLength(1);
        expect(g.over).toBe(false);
    });

    it('공이 여러 개면 하나를 놓쳐도 목숨은 그대로', () => {
        const g = createGame(1);
        fly(g, 20, 480, 1, -1, 1);
        g.balls.push({ ...g.balls[0], id: 100, x: 180 * S, y: 200 * S, sy: -1 });
        sentinel(g);
        const ev = runUntil(g, 300, has('ball-lost'));
        expect(ev.some((e) => e.type === 'ball-lost')).toBe(true);
        expect(g.lives).toBe(START_LIVES);
        expect(g.balls).toHaveLength(1);
    });

    it('마지막 목숨을 잃으면 끝나고, 끝난 판은 더 진행하지 않는다', () => {
        const g = createGame(1);
        g.lives = 1;
        fly(g, 20, 480, 1, -1, 1);
        const ev = runUntil(g, 300, has('over'));
        expect(ev.some((e) => e.type === 'over')).toBe(true);
        expect(g.over).toBe(true);
        expect(g.reason).toBe('lives');
        const t = g.tick;
        expect(step(g, { x: 10 })).toEqual([]);
        expect(g.tick).toBe(t);
    });

    it('최대 틱에 이르면 끝난다', () => {
        const g = createGame(1);
        g.tick = MAX_TICKS - 1;
        step(g, { x: 180 });
        expect(g.over).toBe(true);
        expect(g.reason).toBe('limit');
    });
});

describe('스테이지 클리어', () => {
    function clearLast(g: Game): StepEvent[] {
        blank(g);
        setBrick(g, 4, 5, BRICK_NORMAL);
        const [, , , bt] = brickRect(4, 5);
        fly(g, 160, bt / S + 30, 1, 1, -1);
        return runUntil(g, 300, has('clear'), 120);
    }

    it('깨지는 벽돌을 다 깨면 보너스를 받고 다음 스테이지로', () => {
        const g = createGame(1);
        const ev = clearLast(g);
        const bonus = STAGE_BONUS + START_LIVES * LIFE_BONUS;
        expect(ev).toContainEqual({ type: 'clear', bonus });
        expect(g.stage).toBe(1);
        expect(g.stagesCleared).toBe(1);
        expect(g.score).toBe(hitPoints(10, 0, 0) + bonus);
        expect(g.attached).toBe(true);
        expect(g.items).toHaveLength(0);
        expect(g.remaining).toBe(STAGES[1].join('').replace(/[^123]/g, '').length);
    });

    it('안 깨지는 벽돌이 남아 있어도 클리어된다', () => {
        const g = createGame(1);
        blank(g);
        setBrick(g, 0, 0, BRICK_SOLID);
        setBrick(g, 9, 0, BRICK_SOLID);
        setBrick(g, 4, 5, BRICK_NORMAL);
        const [, , , bt] = brickRect(4, 5);
        fly(g, 160, bt / S + 30, 1, 1, -1);
        const ev = runUntil(g, 300, has('clear'), 120);
        expect(ev.some((e) => e.type === 'clear')).toBe(true);
    });

    it('5스테이지 다음은 1스테이지부터 더 빠르게', () => {
        const g = createGame(1);
        g.stage = 4;
        clearLast(g);
        expect(g.stage).toBe(0);
        expect(g.loop).toBe(1);
        expect(ballSpeed(g)).toBe(BASE_SPEED + LOOP_SPEED_STEP);
    });

    it('스테이지가 오를수록 공이 빨라지고 상한이 있다', () => {
        const g = createGame(1);
        const speeds = [0, 1, 2, 3, 4].map((s) => {
            g.stage = s;
            return ballSpeed(g);
        });
        for (let k = 1; k < speeds.length; k++) {
            expect(speeds[k]).toBeGreaterThan(speeds[k - 1]);
        }
        g.loop = 100;
        expect(ballSpeed(g)).toBe(MAX_SPEED);
    });
});

describe('벽돌·점수', () => {
    it('단단한 벽돌은 정해진 횟수만큼 맞아야 깨진다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_HARD3);
        const [, , , bt] = brickRect(4, 5);
        const results: boolean[] = [];
        for (let k = 0; k < 3; k++) {
            g.combo = 0;
            fly(g, 160, bt / S + 30, 1, 1, -1);
            const ev = runUntil(g, 300, has('brick'), 60);
            const hit = ev.find((e) => e.type === 'brick');
            results.push(hit?.type === 'brick' && hit.broken);
        }
        expect(results).toEqual([false, false, true]);
        expect(g.kinds[5 * BRICK_COLS + 4]).toBe(BRICK_NONE);
    });

    it('콤보: 맞힐 때마다 0.25배씩, 최대 3배', () => {
        expect(hitPoints(10, 0, 0)).toBe(10);
        expect(hitPoints(10, 1, 0)).toBe(12);
        expect(hitPoints(10, 4, 0)).toBe(20);
        expect(hitPoints(10, 8, 0)).toBe(30);
        expect(hitPoints(10, 50, 0)).toBe(30);
        // 바퀴를 돌 때마다 기본 점수 증가
        expect(hitPoints(10, 0, 1)).toBe(20);
    });

    it('연속으로 맞히면 콤보가 쌓여 점수에 반영된다', () => {
        const g = createGame(1);
        blank(g);
        sentinel(g);
        setBrick(g, 4, 5, BRICK_NORMAL);
        g.combo = 3;
        const [, , , bt] = brickRect(4, 5);
        fly(g, 160, bt / S + 30, 1, 1, -1);
        const ev = runUntil(g, 300, has('brick'), 60);
        const hit = ev.find((e) => e.type === 'brick');
        expect(hit?.type === 'brick' && hit.points).toBe(hitPoints(10, 3, 0));
        expect(g.combo).toBe(4);
        expect(g.maxCombo).toBe(4);
    });
});

describe('아이템', () => {
    it('어떤 벽돌에서 떨어질지는 seed 로 정해진다', () => {
        let dropped = 0;
        let notDropped = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const g = createGame(seed);
            const expectDrop = mulberry32(seed)[1] % 100 < DROP_PERCENT;
            blank(g);
            sentinel(g);
            setBrick(g, 4, 5, BRICK_NORMAL);
            const [, , , bt] = brickRect(4, 5);
            fly(g, 160, bt / S + 30, 1, 1, -1);
            const ev = runUntil(g, 300, has('brick'), 60);
            const drop = ev.some((e) => e.type === 'drop');
            expect(drop).toBe(expectDrop);
            if (drop) dropped++;
            else notDropped++;
        }
        expect(dropped).toBeGreaterThan(0);
        expect(notDropped).toBeGreaterThan(dropped);
    });

    it('떨어지는 아이템을 막대로 받으면 적용된다', () => {
        const g = createGame(1);
        g.items.push({ kind: ITEM_WIDE, x: 180 * S, y: 470 * S, py: 470 * S });
        const ev = runUntil(g, 180, has('catch'), 60);
        expect(ev).toContainEqual({ type: 'catch', kind: ITEM_WIDE });
        expect(g.paddleHalf).toBe((PADDLE_WIDE_W * S) / 2);
        expect(g.score).toBe(ITEM_POINTS);
    });

    it('막대 밖으로 떨어진 아이템은 사라진다', () => {
        const g = createGame(1);
        g.items.push({ kind: ITEM_LIFE, x: 20 * S, y: 470 * S, py: 470 * S });
        const ev = runUntil(g, 300, () => false, 60);
        expect(ev.some((e) => e.type === 'catch')).toBe(false);
        expect(g.items).toHaveLength(0);
        expect(g.lives).toBe(START_LIVES);
    });

    it('막대 넓게 — 일정 시간 뒤 원래대로', () => {
        const g = createGame(1);
        applyItem(g, ITEM_WIDE);
        expect(g.paddleHalf).toBe((PADDLE_WIDE_W * S) / 2);
        for (let k = 0; k < WIDE_TICKS; k++) step(g, { x: 180 });
        expect(g.paddleHalf).toBe((PADDLE_W * S) / 2);
    });

    it('공 여러 개 — 공이 3개가 되고 상한을 넘지 않는다', () => {
        const g = createGame(1);
        fly(g, 180, 300, 4, 1, -1);
        applyItem(g, ITEM_MULTI);
        expect(g.balls).toHaveLength(3);
        expect(new Set(g.balls.map((b) => b.id)).size).toBe(3);
        for (let k = 0; k < 10; k++) applyItem(g, ITEM_MULTI);
        expect(g.balls).toHaveLength(MAX_BALLS);
    });

    it('공이 막대에 붙어 있을 때 공 여러 개는 점수만 준다', () => {
        const g = createGame(1);
        applyItem(g, ITEM_MULTI);
        expect(g.balls).toHaveLength(1);
        expect(g.score).toBe(ITEM_POINTS);
    });

    it('공 느리게 — 일정 시간 동안 속력 2/3', () => {
        const g = createGame(1);
        applyItem(g, ITEM_SLOW);
        expect(ballSpeed(g)).toBe(Math.trunc((BASE_SPEED * 2) / 3));
        for (let k = 0; k < SLOW_TICKS; k++) step(g, { x: 180 });
        expect(ballSpeed(g)).toBe(BASE_SPEED);
    });

    it('목숨 +1 — 가득이면 점수로', () => {
        const g = createGame(1);
        applyItem(g, ITEM_LIFE);
        expect(g.lives).toBe(START_LIVES + 1);
        g.lives = MAX_LIVES;
        const before = g.score;
        applyItem(g, ITEM_LIFE);
        expect(g.lives).toBe(MAX_LIVES);
        expect(g.score).toBe(before + ITEM_POINTS + FULL_LIFE_POINTS);
    });

    it('목숨을 잃으면 효과와 떨어지던 아이템이 사라진다', () => {
        const g = createGame(1);
        fly(g, 20, 480, 1, -1, 1);
        applyItem(g, ITEM_WIDE);
        applyItem(g, ITEM_SLOW);
        g.items.push({ kind: ITEM_LIFE, x: 300 * S, y: 100 * S, py: 100 * S });
        runUntil(g, 300, has('life-lost'));
        expect(g.items).toHaveLength(0);
        expect(g.wideTicks).toBe(0);
        expect(g.slowTicks).toBe(0);
        expect(g.paddleHalf).toBe((PADDLE_W * S) / 2);
    });
});

describe('입력 기록', () => {
    it('막대 x 는 바뀐 틱만, 발사는 실제로 쏜 틱만 남긴다', () => {
        const g = createGame(1);
        step(g, { x: 180 });
        step(g, { x: 180 });
        step(g, { x: 200.7 });
        step(g, { x: 200 });
        step(g, { x: 210, launch: true });
        step(g, { x: 210, launch: true });
        step(g, { x: -50 });
        step(g, { x: 9999 });
        expect(g.log.moves).toEqual([2, 200, 4, 210, 6, 0, 7, FIELD_W]);
        expect(g.log.launches).toEqual([4]);
    });

    it('막대는 판 밖으로 나가지 않는다', () => {
        const g = createGame(1);
        step(g, { x: 0 });
        expect(g.paddleX).toBe((PADDLE_W * S) / 2);
        step(g, { x: FIELD_W });
        expect(g.paddleX).toBe(FIELD_W * S - (PADDLE_W * S) / 2);
    });

    it('봇 판에서 아이템·클리어가 실제로 일어나고 재연과 맞는다', () => {
        const g = botRun(8, 30000, { jitter: 6 });
        expect(g.bricksBroken).toBeGreaterThan(10);
        const res = replay(8, g.log, g.tick);
        expect(res.ok).toBe(true);
        const r = res.game;
        expect(r.score).toBe(g.score);
        expect(r.stagesCleared).toBe(g.stagesCleared);
    });
});

describe('재연 기록 검사', () => {
    /** 짧은 정상 판: 40틱에 x=200 으로 옮기고 50틱에 발사, 200틱까지 */
    function sample(): { log: GameLog; ticks: number } {
        const g = createGame(9);
        for (let t = 0; t < 200; t++) step(g, { x: t < 40 ? 180 : 200, launch: t === 50 });
        return { log: g.log, ticks: g.tick };
    }

    it('엔진이 남긴 기록은 통과한다', () => {
        const { log, ticks } = sample();
        expect(log).toEqual({ moves: [40, 200], launches: [50] });
        expect(replay(9, log, ticks).ok).toBe(true);
    });

    it('어긋난 기록은 이유와 함께 거부한다', () => {
        const cases: Array<[GameLog, number, string]> = [
            [{ moves: [40], launches: [] }, 200, 'bad-log'],
            [{ moves: [40.5, 200], launches: [] }, 200, 'bad-log'],
            [{ moves: [40, 200], launches: [] }, -1, 'bad-ticks'],
            [{ moves: [40, 200], launches: [] }, MAX_TICKS + 1, 'bad-ticks'],
            [{ moves: [40, 200, 40, 210], launches: [] }, 200, 'tick-order'],
            [{ moves: [40, 200, 30, 210], launches: [] }, 200, 'tick-order'],
            [{ moves: [], launches: [50, 50] }, 200, 'tick-order'],
            [{ moves: [40, 361], launches: [] }, 200, 'x-range'],
            [{ moves: [40, -1], launches: [] }, 200, 'x-range'],
            [{ moves: [40, 180], launches: [] }, 200, 'x-unchanged'],
            [{ moves: [40, 200, 41, 200], launches: [] }, 200, 'x-unchanged'],
            [{ moves: [250, 200], launches: [] }, 200, 'tick-range'],
            [{ moves: [], launches: [200] }, 200, 'tick-range'],
            [{ moves: [], launches: [50, 60] }, 200, 'launch-detached']
        ];
        for (const [log, ticks, error] of cases) {
            const res = replay(9, log, ticks);
            expect(res.ok).toBe(false);
            expect(res.error).toBe(error);
        }
    });

    it('판이 끝난 뒤의 틱까지 길이를 주장하면 거부한다', () => {
        // 공이 있는 반대쪽 끝으로 막대를 피해 목숨 3개를 다 잃는다
        const g = createGame(4);
        for (let t = 0; t < 50000 && !g.over; t++) {
            const ball = g.balls[0];
            const x = ball && ball.x < (FIELD_W / 2) * S ? FIELD_W : 0;
            step(g, { x, launch: g.attached });
        }
        expect(g.over).toBe(true);
        expect(replay(4, g.log, g.tick).ok).toBe(true);
        const res = replay(4, g.log, g.tick + 10);
        expect(res.ok).toBe(false);
        expect(res.error).toBe('length');
    });
});

describe('보조', () => {
    it('원-사각형 충돌은 가장자리에 딱 닿은 것을 겹침으로 보지 않는다', () => {
        const r = BALL_R * S;
        expect(circleHitsRect(0, -r, 0, 0, 10 * S, 10 * S)).toBe(false);
        expect(circleHitsRect(0, -r + 1, 0, 0, 10 * S, 10 * S)).toBe(true);
    });

    it('벽돌 종류', () => {
        expect(isBreakable(BRICK_SOLID)).toBe(false);
        expect(isBreakable(BRICK_HARD2)).toBe(true);
        expect(brickHp(BRICK_SOLID)).toBe(0);
    });
});

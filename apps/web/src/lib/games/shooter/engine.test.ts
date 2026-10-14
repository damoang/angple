/**
 * 앙 스트라이커 엔진 테스트 — 경로 표, 결정성·재연·정수 상태, 입장·흔들림·급강하(편대 흔들림 포함),
 * 발사 버튼(누를 때만·누르고 있으면 연사), 점수(편대 < 급강하, 대장+호위), 보너스 스테이지,
 * 목숨·추가 목숨, 아이템, 터널링, 객체 상한, 난이도 곡선(초보 봇 생존 시간)
 */
import { describe, it, expect } from 'vitest';
import {
    EBULLET_HH,
    ENEMY_HALF,
    FIELD_H,
    FIRE_TICKS,
    FIELD_W,
    INVULN_TICKS,
    MAX_BULLETS,
    MAX_ENEMIES,
    MAX_ENEMY_BULLETS,
    MAX_SHOTS,
    MAX_TICKS,
    M_DIVE,
    M_ENTER,
    M_FLY,
    M_FORM,
    M_HOME,
    M_WAIT,
    PH_CLEAR,
    RAPID_FIRE_TICKS,
    RAPID_SHOTS,
    RAPID_TICKS,
    RESPAWN_TICKS,
    SCALE,
    SHIP_Y,
    STAGE_GAP_TICKS,
    START_LIVES,
    START_X,
    SWAY_PX,
    SWAY_TICKS,
    TICK_HZ,
    addScore,
    createGame,
    loadStage,
    mulberry32,
    replay,
    slotPos,
    startDive,
    step,
    swayAt,
    type Enemy,
    type Game,
    type GameLog,
    type StepEvent
} from './engine';
import { BONUS_PATHS, ENTRY_PATHS, SEG_LEN, bezier, pathPoint, pathTicks, toPath } from './paths';
import {
    BONUS_PERFECT,
    DIVE_POINTS,
    ENEMY_BOSS,
    ENEMY_GRUNT,
    EXTEND_AT,
    FORM_POINTS,
    ITEM_POINTS,
    ITEM_RAPID,
    ITEM_SHIELD,
    LAYOUTS,
    SQUAD_BONUS,
    bulletSpeed,
    diveInterval,
    diveTicks,
    fireChance,
    isBonusStage,
    maxDivers
} from './stages';

const S = SCALE;

/** 발사 버튼을 눌러도 쏘지 않게 한다 (총알을 직접 놓는 테스트용) */
function noFire(g: Game): void {
    g.fireCd = 1e9;
}

/** 모든 적을 곧바로 편대 자리에 앉힌다 */
function settle(g: Game): void {
    for (const e of g.enemies) {
        const [x, y] = slotPos(e.slot, g.tick);
        e.mode = M_FORM;
        e.x = x;
        e.y = y;
        e.px = x;
        e.py = y;
    }
    g.entering = 0;
}

/** 적 하나만 있는 판 */
function solo(kind: number, mode: number, x: number, y: number, path: number[] = []): Game {
    const g = createGame(1);
    noFire(g);
    const e: Enemy = {
        id: 999,
        kind,
        hp: kind === ENEMY_BOSS ? 2 : 1,
        slot: 34,
        mode,
        x: x * S,
        y: y * S,
        px: x * S,
        py: y * S,
        path,
        t: 0,
        wait: 0,
        fire1: -1,
        fire2: -1,
        squad: 0
    };
    g.enemies = [e];
    g.entering = 0;
    // 편대에 있는 적은 자기 칸(34 = 4줄 5번째) 위치에 둔다 — 첫 틱에 튀지 않게
    if (mode === M_FORM) settle(g);
    return g;
}

/** 적 바로 아래에 내 총알 하나를 놓는다 */
function shootAt(g: Game, e: Enemy): void {
    const y = e.y + 8 * S;
    g.shots.push({ x: e.x, y, py: y });
}

const types = (ev: StepEvent[]) => ev.map((e) => e.type);

/** 상태 안의 모든 숫자가 정수인가 */
function allIntegers(v: unknown): boolean {
    if (typeof v === 'number') return Number.isSafeInteger(v);
    if (Array.isArray(v)) return v.every(allIntegers);
    if (v && typeof v === 'object') return Object.values(v).every(allIntegers);
    return true;
}

/** 무작위 손놀림 — 가끔 목표를 바꾸고, 가끔 발사 버튼을 누르거나 뗀다 (결정성 테스트용) */
function randomRun(seed: number, ticks: number, check?: (g: Game) => void): Game {
    const g = createGame(seed);
    let r = (seed ^ 0x5bd1e995) >>> 0;
    let x = START_X;
    let fire = true;
    for (let t = 0; t < ticks && !g.over; t++) {
        const [nr, u] = mulberry32(r);
        r = nr;
        if (u % 7 === 0) x = u % (FIELD_W + 1);
        if ((u >>> 8) % 13 === 0) fire = !fire;
        step(g, { x, fire });
        check?.(g);
    }
    return g;
}

/**
 * 초보 봇 — 사람의 반응 속도(0.25초)마다 한 번만 판단한다.
 * - 비행기 줄 위 150px 안에서 이쪽으로 오는 적 총알, 170px 안의 내려오는 적이 있으면
 *   가까운 쪽부터 40px 씩 옆을 살펴 안전한 곳으로 옮긴다.
 * - 위험이 없으면 가장 가까운 적 밑으로 간다(쏘려고).
 * - 발사 버튼은 판 내내 누르고 있다(누르고 있으면 연사).
 * 돌려주는 값: 판이 끝난 틱(끝까지 살면 max).
 */
function noviceRun(seed: number, max: number, react = 15): number {
    const g = createGame(seed);
    let target = START_X;
    const danger = (x: number): boolean => {
        for (const b of g.bullets) {
            const by = b.y / S;
            if (by < SHIP_Y - 150 || by > SHIP_Y + 8) continue;
            const ticks = b.vy > 0 ? (SHIP_Y * S - b.y) / b.vy : 0;
            const bx = (b.x + b.vx * Math.max(0, ticks)) / S;
            if (Math.abs(bx - x) < 22) return true;
        }
        for (const e of g.enemies) {
            if (e.mode === M_WAIT || e.mode === M_FORM || e.mode === M_FLY) continue;
            const ey = e.y / S;
            if (ey < SHIP_Y - 170 || ey > SHIP_Y + 16) continue;
            if (Math.abs(e.x / S - x) < 30) return true;
        }
        return false;
    };
    const decide = () => {
        const ship = g.shipX / S;
        if (danger(ship)) {
            for (const d of [40, -40, 80, -80, 120, -120, 160, -160]) {
                const x = ship + d;
                if (x < 14 || x > FIELD_W - 14) continue;
                if (!danger(x)) return x;
            }
            return target;
        }
        let best = target;
        let bestD = Infinity;
        for (const e of g.enemies) {
            if (e.mode === M_WAIT || e.y / S > SHIP_Y - 200) continue;
            const d = Math.abs(e.x / S - ship);
            if (d < bestD) {
                bestD = d;
                best = e.x / S;
            }
        }
        return best;
    };
    for (let t = 0; t < max; t++) {
        if (t % react === 0) target = Math.round(Math.min(FIELD_W, Math.max(0, decide())));
        step(g, { x: target, fire: true });
        if (g.over) return g.tick;
    }
    return max;
}

describe('경로 표', () => {
    it('베지어는 t=0 에서 첫 점, t=n 에서 끝 점이고 정수다', () => {
        expect(bezier(10, 50, 90, 130, 0, 60)).toBe(10);
        expect(bezier(10, 50, 90, 130, 60, 60)).toBe(130);
        for (let t = 0; t <= 60; t++) {
            expect(Number.isInteger(bezier(-20 * S, 120 * S, 40 * S, 130 * S, t, 60))).toBe(true);
        }
    });

    it('조각이 이어져 있고(끝 점 = 다음 첫 점) 틱 수는 1~255', () => {
        for (const table of [...ENTRY_PATHS, ...BONUS_PATHS]) {
            expect(table.length % SEG_LEN).toBe(0);
            for (let i = 0; i < table.length; i += SEG_LEN) {
                expect(table[i]).toBeGreaterThan(0);
                expect(table[i]).toBeLessThanOrEqual(255);
                if (i + SEG_LEN < table.length) {
                    expect(table[i + SEG_LEN + 1]).toBe(table[i + 7]);
                    expect(table[i + SEG_LEN + 2]).toBe(table[i + 8]);
                }
            }
        }
    });

    it('경로 위치는 틱마다 조금씩만 움직이고(순간이동 없음) 좌우 뒤집기가 맞다', () => {
        const out = [0, 0];
        for (const table of ENTRY_PATHS) {
            const path = toPath(table, S, FIELD_W, false);
            const mirror = toPath(table, S, FIELD_W, true);
            let px = path[1];
            let py = path[2];
            for (let t = 1; t <= pathTicks(path); t++) {
                pathPoint(path, t, out);
                expect(Math.abs(out[0] - px)).toBeLessThan(12 * S);
                expect(Math.abs(out[1] - py)).toBeLessThan(12 * S);
                px = out[0];
                py = out[1];
                // 뒤집은 쪽은 정수 버림 방향이 달라 1단위(1/256px)까지 어긋날 수 있다
                pathPoint(mirror, t, out);
                expect(Math.abs(out[0] - (FIELD_W * S - px))).toBeLessThanOrEqual(1);
            }
        }
    });

    it('보너스 경로는 판 밖에서 끝난다', () => {
        const out = [0, 0];
        for (const table of BONUS_PATHS) {
            const path = toPath(table, S, FIELD_W, false);
            pathPoint(path, pathTicks(path), out);
            const off =
                out[0] < -ENEMY_HALF * S ||
                out[0] > (FIELD_W + ENEMY_HALF) * S ||
                out[1] < -ENEMY_HALF * S ||
                out[1] > (FIELD_H + ENEMY_HALF) * S;
            expect(off).toBe(true);
        }
    });
});

describe('편대 표', () => {
    it('배치는 10칸 × 5줄, 알려진 글자만, 적 상한(40) 이하, 대장이 있다', () => {
        for (const rows of LAYOUTS) {
            expect(rows).toHaveLength(5);
            for (const line of rows) {
                expect(line).toHaveLength(10);
                expect(line).toMatch(/^[.BMG]+$/);
            }
            const n = rows.join('').replace(/\./g, '').length;
            expect(n).toBeLessThanOrEqual(MAX_ENEMIES);
            expect(rows[0]).toMatch(/B/);
        }
    });

    it('3스테이지마다 보너스 스테이지', () => {
        expect([1, 2, 3, 4, 5, 6, 9].map(isBonusStage)).toEqual([
            false,
            false,
            true,
            false,
            false,
            true,
            true
        ]);
    });
});

describe('새 판', () => {
    it('목숨 3, 1스테이지, 적은 모두 대기 중, 비행기는 가운데', () => {
        const g = createGame(42);
        expect(g.lives).toBe(START_LIVES);
        expect(g.stageNo).toBe(1);
        expect(g.bonus).toBe(false);
        expect(g.enemies.length).toBe(LAYOUTS[0].join('').replace(/\./g, '').length);
        expect(g.enemies.every((e) => e.mode === M_WAIT)).toBe(true);
        expect(g.shipX).toBe(START_X * S);
    });

    it('비행기는 목표 쪽으로 한 틱 최대 8px, 판 밖으로 나가지 않는다', () => {
        const g = createGame(1);
        step(g, { x: 0 });
        expect(g.shipX).toBe((START_X - 8) * S);
        for (let k = 0; k < 40; k++) step(g, { x: 0 });
        expect(g.shipX).toBe(13 * S);
        for (let k = 0; k < 60; k++) step(g, { x: 360 });
        expect(g.shipX).toBe((FIELD_W - 13) * S);
    });

    it('발사 버튼을 누르지 않으면 쏘지 않는다', () => {
        const g = createGame(1);
        for (let k = 0; k < 120; k++) {
            step(g, { x: START_X });
            expect(g.shots).toHaveLength(0);
        }
    });

    it('누르고 있으면 쏘는 간격마다 연사한다 — 동시에 3발까지', () => {
        const g = createGame(1);
        let most = 0;
        const fired: number[] = [];
        for (let k = 0; k < 120; k++) {
            const before = g.shots.length;
            step(g, { x: START_X, fire: true });
            if (g.shots.length > before) fired.push(g.tick);
            most = Math.max(most, g.shots.length);
        }
        expect(most).toBe(MAX_SHOTS);
        // 처음 몇 발은 화면 상한에 걸리기 전이라 정확히 FIRE_TICKS 간격
        expect(fired[1] - fired[0]).toBe(FIRE_TICKS);
        expect(fired[2] - fired[1]).toBe(FIRE_TICKS);
    });

    it('한 번 짧게 누르면 한 발, 간격 안에 다시 눌러도 더 나가지 않는다', () => {
        const g = createGame(1);
        step(g, { x: START_X, fire: true });
        expect(g.shots).toHaveLength(1);
        step(g, { x: START_X });
        step(g, { x: START_X, fire: true });
        expect(g.shots).toHaveLength(1);
        for (let k = 0; k < FIRE_TICKS; k++) step(g, { x: START_X });
        step(g, { x: START_X, fire: true });
        expect(g.shots).toHaveLength(2);
    });
});

describe('결정성', () => {
    it('같은 seed + 같은 입력이면 상태가 똑같다', () => {
        for (const seed of [1, 7, 123456789, 0xdeadbeef]) {
            const a = randomRun(seed, 6000);
            const b = randomRun(seed, 6000);
            expect(JSON.stringify(a)).toBe(JSON.stringify(b));
            expect(a.score).toBeGreaterThan(0);
        }
    });

    it('seed 가 다르면 급강하 순서가 다르다', () => {
        const a = randomRun(1, 3000);
        const b = randomRun(2, 3000);
        expect(JSON.stringify(a.enemies)).not.toBe(JSON.stringify(b.enemies));
    });

    it('기록으로 다시 돌리면(replay) 같은 판이 나온다', () => {
        for (const seed of [3, 99, 2024]) {
            const g = randomRun(seed, 9000);
            const res = replay(seed, g.log, g.tick);
            expect(res.ok).toBe(true);
            expect(res.error).toBe('');
            expect(res.game.tick).toBe(g.tick);
            expect(res.game.score).toBe(g.score);
            expect(JSON.stringify(res.game)).toBe(JSON.stringify(g));
        }
    });

    it('상태에는 정수만 들어간다', () => {
        randomRun(11, 4000, (g) => {
            if (g.tick % 50 === 0) expect(allIntegers(g)).toBe(true);
        });
    });

    it('입력 기록은 x 가 바뀐 틱만 남긴다', () => {
        const g = createGame(1);
        step(g, { x: 180 });
        step(g, { x: 100 });
        step(g, { x: 100 });
        step(g, { x: 100.9 });
        step(g, { x: 500 });
        step(g, { x: -5 });
        expect(g.log.moves).toEqual([1, 100, 4, 360, 5, 0]);
    });

    it('입력 기록은 발사 버튼을 누르거나 뗀 틱만 남긴다', () => {
        const g = createGame(1);
        step(g, { x: 180 });
        step(g, { x: 180, fire: true });
        step(g, { x: 180, fire: true });
        step(g, { x: 180, fire: false });
        step(g, { x: 180 });
        step(g, { x: 180, fire: true });
        expect(g.log.fires).toEqual([1, 3, 5]);
        expect(g.log.moves).toEqual([]);
    });

    it('발사 기록까지 넣어 다시 돌려야 같은 판이다', () => {
        const g = randomRun(5, 3000);
        expect(g.log.fires.length).toBeGreaterThan(0);
        const same = replay(5, g.log, g.tick);
        expect(JSON.stringify(same.game)).toBe(JSON.stringify(g));
        const noFires = replay(5, { moves: g.log.moves, fires: [] }, g.tick);
        expect(JSON.stringify(noFires.game)).not.toBe(JSON.stringify(g));
    });

    it('어긋난 기록은 거부한다', () => {
        const ok = { moves: [1, 100], fires: [2, 5] };
        expect(replay(1, ok, 10).ok).toBe(true);
        expect(replay(1, { moves: [1], fires: [] }, 10).error).toBe('bad-log');
        expect(replay(1, { moves: [1.5, 100], fires: [] }, 10).error).toBe('bad-log');
        expect(replay(1, { moves: [1, 100], fires: [2.5] }, 10).error).toBe('bad-log');
        expect(replay(1, { moves: [1, 100] } as unknown as GameLog, 10).error).toBe('bad-log');
        expect(replay(1, ok, -1).error).toBe('bad-ticks');
        expect(replay(1, ok, MAX_TICKS + 1).error).toBe('bad-ticks');
        expect(replay(1, { moves: [3, 100, 3, 120], fires: [] }, 10).error).toBe('tick-order');
        expect(replay(1, { moves: [], fires: [4, 4] }, 10).error).toBe('tick-order');
        expect(replay(1, { moves: [], fires: [6, 2] }, 10).error).toBe('tick-order');
        expect(replay(1, { moves: [1, 400], fires: [] }, 10).error).toBe('x-range');
        expect(replay(1, { moves: [1, 180], fires: [] }, 10).error).toBe('x-unchanged');
        expect(replay(1, { moves: [10, 100], fires: [] }, 10).error).toBe('tick-range');
        expect(replay(1, { moves: [], fires: [10] }, 10).error).toBe('tick-range');
    });

    it('판이 끝난 뒤까지 이어지는 길이는 거부한다', () => {
        // 가만히 있으면 언젠가 맞아 판이 끝난다
        const seed = 1;
        const g = createGame(seed);
        while (!g.over && g.tick < MAX_TICKS) step(g, { x: 100 });
        expect(g.over).toBe(true);
        expect(g.reason).toBe('lives');
        expect(replay(seed, g.log, g.tick).ok).toBe(true);
        expect(replay(seed, g.log, g.tick + 1).error).toBe('length');
    });
});

describe('입장 → 흔들림 → 급강하', () => {
    it('모두 곡선을 따라 들어와 편대 자리에 앉는다', () => {
        const g = createGame(5);
        noFire(g);
        const seated = new Set<number>();
        for (let t = 0; t < 1500; t++) {
            step(g, { x: START_X });
            for (const e of g.enemies) if (e.mode === M_FORM) seated.add(e.id);
        }
        expect(g.enemies.length).toBeGreaterThan(0);
        for (const e of g.enemies) expect(seated.has(e.id)).toBe(true);
        expect(g.entering).toBe(0);
    });

    it('입장이 끝나기 전에는 급강하하지 않는다', () => {
        const g = createGame(5);
        noFire(g);
        while (g.entering > 0) {
            step(g, { x: START_X });
            expect(g.enemies.some((e) => e.mode === M_DIVE)).toBe(false);
        }
    });

    it('편대는 좌우로 흔들린다 (±16px, 240틱 주기)', () => {
        let lo = 0;
        let hi = 0;
        for (let t = 0; t < SWAY_TICKS; t++) {
            const v = swayAt(t);
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
            expect(swayAt(t + SWAY_TICKS)).toBe(v);
            expect(Math.abs(swayAt(t + 1) - v)).toBeLessThanOrEqual(S);
        }
        expect(lo).toBe(-SWAY_PX * S);
        expect(hi).toBe(SWAY_PX * S);
    });

    it('자리 잡은 뒤 급강하가 시작되고, 내려간 적은 위에서 다시 나와 제자리로 돌아간다', () => {
        const g = createGame(9);
        noFire(g);
        settle(g);
        g.invuln = 1e9; // 부딪혀 떨어지지 않게
        let dived: Enemy | null = null;
        for (let t = 0; t < 600 && !dived; t++) {
            step(g, { x: 20 });
            dived = g.enemies.find((e) => e.mode === M_DIVE) ?? null;
        }
        expect(dived).not.toBeNull();
        const e = dived as Enemy;
        let maxY = 0;
        let back = false;
        for (let t = 0; t < 900 && !g.over; t++) {
            step(g, { x: 20 });
            maxY = Math.max(maxY, e.y);
            if (maxY > FIELD_H * S && e.mode === M_FORM) {
                back = true;
                break;
            }
        }
        expect(maxY).toBeGreaterThan(FIELD_H * S);
        expect(back).toBe(true);
    });

    it('동시 급강하 수는 상한을 넘지 않는다', () => {
        randomRun(21, 8000, (g) => {
            if (g.bonus) return;
            const busy = g.enemies.filter((e) => e.mode === M_DIVE).length;
            expect(busy).toBeLessThanOrEqual(maxDivers(g.level));
        });
    });
});

describe('점수', () => {
    it('편대에 있을 때보다 급강하 중에 맞히면 점수가 크다', () => {
        for (const kind of [1, 2, 3]) {
            expect(DIVE_POINTS[kind]).toBeGreaterThan(FORM_POINTS[kind]);
        }
        // 편대
        const a = solo(ENEMY_GRUNT, M_FORM, 100, 120);
        shootAt(a, a.enemies[0]);
        const ea = step(a, { x: START_X });
        expect(ea).toContainEqual(expect.objectContaining({ type: 'kill', dive: false }));
        expect(a.score).toBe(FORM_POINTS[ENEMY_GRUNT]);
        // 급강하
        const b = solo(ENEMY_GRUNT, M_FORM, 100, 120);
        settle(b);
        startDive(b);
        expect(b.enemies[0].mode).toBe(M_DIVE);
        for (let k = 0; k < 50; k++) step(b, { x: START_X });
        shootAt(b, b.enemies[0]);
        const eb = step(b, { x: START_X });
        expect(eb).toContainEqual(expect.objectContaining({ type: 'kill', dive: true }));
        expect(b.score).toBe(DIVE_POINTS[ENEMY_GRUNT]);
    });

    it('대장은 두 번 맞아야 떨어진다 (첫 번은 점수 없음)', () => {
        const g = solo(ENEMY_BOSS, M_FORM, 180, 80);
        shootAt(g, g.enemies[0]);
        expect(types(step(g, { x: START_X }))).toContain('damage');
        expect(g.enemies[0].hp).toBe(1);
        expect(g.score).toBe(0);
        shootAt(g, g.enemies[0]);
        expect(types(step(g, { x: START_X }))).toContain('kill');
        expect(g.score).toBe(FORM_POINTS[ENEMY_BOSS]);
    });

    it('대장 + 호위를 같은 급강하에서 모두 맞히면 추가 점수', () => {
        let g: Game | null = null;
        for (let r = 1; r < 2000 && !g; r++) {
            const c = createGame(5);
            noFire(c);
            settle(c);
            c.level = 2; // 동시 급강하 4 — 호위 둘
            c.rng = r;
            startDive(c);
            if (c.squads.length === 1 && c.squads[0].escorts === 2) g = c;
        }
        expect(g).not.toBeNull();
        const game = g as Game;
        const id = game.squads[0].id;
        const members = game.enemies.filter((e) => e.squad === id);
        expect(members).toHaveLength(3);
        expect(members.every((e) => e.mode === M_DIVE)).toBe(true);
        const ev: StepEvent[] = [];
        for (let k = 0; k < 40; k++) {
            const alive = members.filter((e) => e.hp > 0);
            if (alive.length === 0) break;
            const low = alive.reduce((a, b) => (b.y > a.y ? b : a));
            shootAt(game, low);
            ev.push(...step(game, { x: 10 }));
        }
        expect(members.every((e) => e.hp <= 0)).toBe(true);
        const squad = ev.find((e) => e.type === 'squad');
        expect(squad).toEqual(expect.objectContaining({ bonus: SQUAD_BONUS[2] }));
    });

    it('2만·7만 점에 목숨 +1 (두 번만)', () => {
        const g = createGame(1);
        const ev: StepEvent[] = [];
        addScore(g, EXTEND_AT[0] - 1, ev);
        expect(g.lives).toBe(START_LIVES);
        addScore(g, 1, ev);
        expect(g.lives).toBe(START_LIVES + 1);
        addScore(g, EXTEND_AT[1], ev);
        expect(g.lives).toBe(START_LIVES + 2);
        addScore(g, 1000000, ev);
        expect(g.lives).toBe(START_LIVES + 2);
        expect(types(ev)).toEqual(['extend', 'extend']);
    });
});

describe('보너스 스테이지', () => {
    function bonusGame(): Game {
        const g = createGame(7);
        g.stageNo = 3;
        g.level = 2;
        loadStage(g);
        noFire(g);
        return g;
    }

    it('적은 쏘지도 급강하하지도 않고 줄지어 지나간다 — 못 맞히면 보너스 0', () => {
        const g = bonusGame();
        expect(g.bonus).toBe(true);
        expect(g.enemies).toHaveLength(40);
        const ev: StepEvent[] = [];
        for (let t = 0; t < 3000 && g.stageNo === 3; t++) {
            ev.push(...step(g, { x: START_X }));
            expect(g.bullets).toHaveLength(0);
            expect(g.enemies.some((e) => e.mode === M_DIVE || e.mode === M_FORM)).toBe(false);
        }
        const res = ev.find((e) => e.type === 'bonus-result');
        expect(res).toEqual({ type: 'bonus-result', hits: 0, total: 40, bonus: 0 });
        expect(g.lives).toBe(START_LIVES);
        expect(g.stageNo).toBe(4);
        expect(g.bonus).toBe(false);
        expect(g.level).toBe(2);
    });

    it('모두 맞히면 퍼펙트 보너스', () => {
        const g = bonusGame();
        const ev: StepEvent[] = [];
        for (let t = 0; t < 3000 && g.stageNo === 3; t++) {
            for (const e of g.enemies) if (e.mode === M_FLY) shootAt(g, e);
            ev.push(...step(g, { x: START_X }));
        }
        const res = ev.find((e) => e.type === 'bonus-result');
        expect(res).toEqual({ type: 'bonus-result', hits: 40, total: 40, bonus: BONUS_PERFECT });
    });
});

describe('스테이지 진행', () => {
    it('적을 모두 떨어뜨리면 잠시 뒤 다음 스테이지 — 더 많은 적', () => {
        const g = createGame(3);
        noFire(g);
        g.enemies = [];
        expect(types(step(g, { x: START_X }))).toContain('clear');
        expect(g.phase).toBe(PH_CLEAR);
        const ev: StepEvent[] = [];
        for (let t = 0; t < STAGE_GAP_TICKS; t++) ev.push(...step(g, { x: START_X }));
        expect(ev).toContainEqual({ type: 'stage', stageNo: 2, bonus: false });
        expect(g.level).toBe(1);
        expect(g.enemies.length).toBe(LAYOUTS[1].join('').replace(/\./g, '').length);
    });

    it('난이도는 오를수록 세지고 상한이 있다', () => {
        for (let lv = 0; lv < 40; lv++) {
            expect(diveInterval(lv + 1)).toBeLessThanOrEqual(diveInterval(lv));
            expect(diveTicks(lv + 1)).toBeLessThanOrEqual(diveTicks(lv));
            expect(bulletSpeed(lv + 1)).toBeGreaterThanOrEqual(bulletSpeed(lv));
            expect(fireChance(lv + 1)).toBeGreaterThanOrEqual(fireChance(lv));
            expect(maxDivers(lv + 1)).toBeGreaterThanOrEqual(maxDivers(lv));
        }
        expect(diveInterval(99)).toBe(60);
        expect(diveTicks(99)).toBe(84);
        expect(bulletSpeed(99)).toBe(5 * S);
        expect(maxDivers(99)).toBe(8);
    });
});

describe('목숨', () => {
    function bulletAtShip(g: Game, above: number, vy = 4 * S): void {
        const y = (SHIP_Y - above) * S;
        g.bullets.push({ x: g.shipX, y, px: g.shipX, py: y, vx: 0, vy });
    }

    it('맞으면 목숨 −1, 잠시 뒤 다시 나와 한동안 무적', () => {
        const g = createGame(1);
        noFire(g);
        bulletAtShip(g, 30);
        const ev: StepEvent[] = [];
        for (let k = 0; k < 20; k++) ev.push(...step(g, { x: START_X }));
        expect(types(ev)).toContain('hit');
        expect(g.lives).toBe(START_LIVES - 1);
        expect(g.dead).toBeGreaterThan(0);
        // 죽어 있는 동안은 발사 버튼을 눌러도 쏘지 않는다
        g.fireCd = 0;
        step(g, { x: START_X, fire: true });
        expect(g.shots).toHaveLength(0);
        const ev2: StepEvent[] = [];
        for (let k = 0; k < RESPAWN_TICKS; k++) ev2.push(...step(g, { x: START_X }));
        expect(types(ev2)).toContain('respawn');
        expect(g.invuln).toBeGreaterThan(INVULN_TICKS - 20);
        noFire(g);
        bulletAtShip(g, 20);
        for (let k = 0; k < 10; k++) step(g, { x: START_X });
        expect(g.lives).toBe(START_LIVES - 1);
    });

    it('목숨이 다 떨어지면 판이 끝난다', () => {
        const g = createGame(1);
        noFire(g);
        g.lives = 1;
        bulletAtShip(g, 20);
        const ev: StepEvent[] = [];
        for (let k = 0; k < 10 && !g.over; k++) ev.push(...step(g, { x: START_X }));
        expect(g.over).toBe(true);
        expect(g.reason).toBe('lives');
        expect(ev).toContainEqual({ type: 'over', reason: 'lives' });
        expect(step(g, { x: 0 })).toEqual([]);
    });

    it('내려온 적과 부딪혀도 맞는다', () => {
        const g = solo(ENEMY_GRUNT, M_DIVE, START_X, SHIP_Y - 40, [
            60,
            START_X * S,
            (SHIP_Y - 40) * S,
            START_X * S,
            (SHIP_Y - 20) * S,
            START_X * S,
            SHIP_Y * S,
            START_X * S,
            (FIELD_H + 40) * S
        ]);
        const ev: StepEvent[] = [];
        for (let k = 0; k < 40 && !g.dead; k++) ev.push(...step(g, { x: START_X }));
        expect(types(ev)).toContain('hit');
        expect(types(ev)).toContain('kill');
        expect(g.lives).toBe(START_LIVES - 1);
    });
});

describe('아이템', () => {
    it('대장을 떨어뜨리면 가끔 아이템이 떨어진다 (seed 로 정해짐)', () => {
        let drops = 0;
        const kinds = new Set<number>();
        for (let r = 0; r < 200; r++) {
            const g = solo(ENEMY_BOSS, M_FORM, 180, 80);
            g.rng = r;
            g.enemies[0].hp = 1;
            shootAt(g, g.enemies[0]);
            for (const e of step(g, { x: START_X })) {
                if (e.type === 'drop') {
                    drops++;
                    kinds.add(e.kind);
                }
            }
        }
        expect(drops).toBeGreaterThan(40);
        expect(drops).toBeLessThan(110);
        expect([...kinds].sort()).toEqual([ITEM_RAPID, ITEM_SHIELD]);
    });

    it('방패는 한 번 막아 준다', () => {
        const g = createGame(1);
        noFire(g);
        g.items.push({ kind: ITEM_SHIELD, x: g.shipX, y: (SHIP_Y - 30) * S, py: 0 });
        const ev: StepEvent[] = [];
        for (let k = 0; k < 30; k++) ev.push(...step(g, { x: START_X }));
        expect(ev).toContainEqual({ type: 'catch', kind: ITEM_SHIELD });
        expect(g.shield).toBe(true);
        expect(g.score).toBe(ITEM_POINTS);
        const y = (SHIP_Y - 20) * S;
        g.bullets.push({ x: g.shipX, y, px: g.shipX, py: y, vx: 0, vy: 4 * S });
        const ev2: StepEvent[] = [];
        for (let k = 0; k < 10; k++) ev2.push(...step(g, { x: START_X }));
        expect(types(ev2)).toContain('shield');
        expect(types(ev2)).not.toContain('hit');
        expect(g.shield).toBe(false);
        expect(g.lives).toBe(START_LIVES);
    });

    it('연사 강화는 더 많이 쏘고 시간이 지나면 끝난다', () => {
        const g = createGame(1);
        g.items.push({ kind: ITEM_RAPID, x: g.shipX, y: (SHIP_Y - 10) * S, py: 0 });
        let most = 0;
        const fired: number[] = [];
        for (let k = 0; k < 120; k++) {
            const before = g.shots.length;
            step(g, { x: START_X, fire: true });
            if (g.shots.length > before) fired.push(g.tick);
            most = Math.max(most, g.shots.length);
        }
        expect(g.rapidTicks).toBeGreaterThan(0);
        expect(most).toBe(RAPID_SHOTS);
        // 아이템을 먹은 뒤에는 더 짧은 간격으로 연사한다
        const gaps = fired.slice(1).map((t, i) => t - fired[i]);
        expect(gaps).toContain(RAPID_FIRE_TICKS);
        for (let k = 0; k < RAPID_TICKS; k++) step(g, { x: START_X });
        expect(g.rapidTicks).toBe(0);
    });
});

describe('터널링 없음', () => {
    it('내 총알은 어느 거리에서 쏴도 적을 건너뛰지 않는다', () => {
        for (let gap = 0; gap <= 60; gap++) {
            const g = solo(ENEMY_GRUNT, M_FORM, 180, 200);
            const e = g.enemies[0];
            const y = e.y + gap * S;
            g.shots.push({ x: e.x, y, py: y });
            let killed = false;
            for (let k = 0; k < 10 && !killed; k++) {
                killed = types(step(g, { x: START_X })).includes('kill');
                if (!killed) for (const s of g.shots) expect(s.y).toBeGreaterThan(e.y);
            }
            expect(killed).toBe(true);
        }
    });

    it('빠르게 내려오는 적도 마주 오는 총알을 건너뛰지 못한다', () => {
        for (let gap = 0; gap <= 200; gap += 3) {
            const top = 100;
            const g = solo(ENEMY_GRUNT, M_DIVE, 100, top, [
                60,
                100 * S,
                top * S,
                100 * S,
                (top + 160) * S,
                100 * S,
                (top + 320) * S,
                100 * S,
                (top + 480) * S
            ]);
            const e = g.enemies[0];
            const y = e.y + (40 + gap) * S;
            g.shots.push({ x: e.x, y, py: y });
            let killed = false;
            for (let k = 0; k < 30 && !killed; k++) {
                killed = types(step(g, { x: 300 })).includes('kill');
                if (!killed) for (const s of g.shots) expect(s.y).toBeGreaterThan(e.y);
            }
            expect(killed).toBe(true);
        }
    });

    it('아주 빠른 적 총알도 비행기를 건너뛰지 못한다', () => {
        for (const vy of [bulletSpeed(99), 20 * S, 40 * S]) {
            for (let above = 20; above < 80; above += 7) {
                const g = createGame(1);
                noFire(g);
                const y = (SHIP_Y - above) * S;
                g.bullets.push({ x: g.shipX, y, px: g.shipX, py: y, vx: 0, vy });
                const ev: StepEvent[] = [];
                for (let k = 0; k < 20; k++) ev.push(...step(g, { x: START_X }));
                expect(types(ev)).toContain('hit');
            }
        }
    });

    it('비행기 아래로 지나간 총알은 판 밖에서 사라진다', () => {
        const g = createGame(1);
        noFire(g);
        const y = (FIELD_H - 2) * S;
        g.bullets.push({ x: 10 * S, y, px: 10 * S, py: y, vx: 0, vy: 4 * S });
        for (let k = 0; k < 5; k++) step(g, { x: START_X });
        expect(g.bullets).toHaveLength(0);
        expect(EBULLET_HH).toBeGreaterThan(0);
    });
});

describe('동시 객체 상한', () => {
    it('적 40, 총알(내 것 + 적) 60 을 넘지 않는다', () => {
        expect(MAX_BULLETS).toBe(60);
        for (const seed of [4, 8, 15]) {
            randomRun(seed, 12000, (s) => {
                expect(s.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
                expect(s.shots.length).toBeLessThanOrEqual(RAPID_SHOTS);
                expect(s.bullets.length).toBeLessThanOrEqual(MAX_ENEMY_BULLETS);
                expect(s.shots.length + s.bullets.length).toBeLessThanOrEqual(MAX_BULLETS);
            });
        }
    });
});

describe('난이도 곡선', () => {
    /*
     * 목표: 처음 하는 사람의 첫 판 평균 생존 시간 1분 이상.
     * 근거(봇): 「초보 봇」은 0.25초마다 한 번만 판단하고, 위험을 40px 단위로만 피하며,
     * 가장 가까운 적 밑으로 무작정 간다(발사 버튼은 계속 누르고 있음) — 사람보다 둔한 쪽으로 잡았다.
     * 이 봇의 seed 12개 평균이 1분(3,600틱)을 넘는지 본다.
     * 근거(수식, 1스테이지): 급강하 간격 150틱(2.5초)·동시 2마리, 적 총알 3px/틱이고 비행기 줄
     * 160px 위보다 가까이서는 쏘지 않으므로 총알이 닿기까지 최소 53틱(0.9초). 비행기는 맞는 상자 폭
     * 14px 이라 18px(2틱)만 옆으로 가면 피한다. 급강하 하나가 쏘는 총알은 평균 0.5발.
     */
    it('초보 봇의 첫 판 평균 생존 시간이 1분 이상', () => {
        const max = 5 * 60 * TICK_HZ;
        const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const lives = seeds.map((s) => noviceRun(s, max));
        const avg = lives.reduce((a, b) => a + b, 0) / lives.length;
        const sec = (t: number) => Math.round(t / TICK_HZ);
        console.log(`[shooter] 초보 봇 생존(초): ${lives.map(sec).join(', ')} · 평균 ${sec(avg)}`);
        // 가운데 가만히 서서 발사 버튼만 누르고 있는 경우(참고용 — 단언하지 않음)
        const idle = seeds.map((s) => {
            const g = createGame(s);
            while (!g.over && g.tick < max) step(g, { x: START_X, fire: true });
            return g.tick;
        });
        const idleAvg = idle.reduce((a, b) => a + b, 0) / idle.length;
        console.log(`[shooter] 가만히 있기(발사만) 생존(초): 평균 ${sec(idleAvg)}`);
        expect(avg).toBeGreaterThanOrEqual(60 * TICK_HZ);
    });
});

// 쓰지 않는 상수 경고 방지 (상태 이름이 모두 정의돼 있는지)
describe('상태 이름', () => {
    it('적 상태 값은 서로 다르다', () => {
        const all = [M_WAIT, M_ENTER, M_HOME, M_FORM, M_DIVE, M_FLY];
        expect(new Set(all).size).toBe(all.length);
    });
});

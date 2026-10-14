/**
 * 다모앙 특공대 엔진 테스트 — 타일 충돌(바닥 뚫림·벽 끼임 없음·한쪽 발판), 점프 높이(누른 길이),
 * 결정성·재연·정수 상태, 동시 객체 상한, 목숨·재등장 무적, 상자·수류탄, 카메라·잠금 구간,
 * 시험 구간 데이터와 끝까지 갈 수 있는지(무적 봇), 그림 데이터(크기·팔레트)
 */
import { describe, it, expect } from 'vitest';
import {
    CRATE_POINTS,
    DEATH_TICKS,
    ENEMY_BULLET_SPEED,
    INVULN_TICKS,
    MAX_BULLETS,
    MAX_ENEMIES,
    MAX_FALL,
    MAX_GRENADES,
    MAX_TICKS,
    OWNER_ENEMY,
    PLAYER_H,
    PLAYER_W,
    START_GRENADES,
    START_LIVES,
    VIEW_W,
    centerX,
    createGame,
    feetY,
    replay,
    spawnBullet,
    step,
    type Enemy,
    type Game,
    type StepEvent
} from './engine';
import {
    SCALE,
    TILE,
    TILE_U,
    T_EMPTY,
    T_PLATFORM,
    T_SOLID,
    boxHitsSolid,
    isSolid,
    moveX,
    moveY,
    tileAt,
    type Body
} from './physics';
import { ENEMY_DUMMY, TEST_STAGE, buildMap, type StageDef } from './stages';
import {
    BTN_DOWN,
    BTN_FIRE,
    BTN_GRENADE,
    BTN_JUMP,
    BTN_LEFT,
    BTN_RIGHT,
    BTN_UP,
    padBits
} from './input';
import {
    ART,
    CHAR_SIZE,
    LEGS_CROUCH,
    LEGS_JUMP,
    LEGS_RUN,
    LEGS_STAND,
    PALETTE,
    TILE_SIZE,
    UPPER_FORWARD,
    UPPER_UP,
    composeSoldier
} from './sprites';

const S = SCALE;
/** 땅 맨 위 줄 (시험용 평지) */
const GROUND_ROW = 12;
const GROUND_Y = GROUND_ROW * TILE_U;

/** 시험용 평지 스테이지 — 60칸, 바닥 12줄, 출발 3열 */
function flat(over: Partial<StageDef> = {}): StageDef {
    return {
        name: 'test',
        cols: 60,
        rows: 14,
        ground: [[0, 59, GROUND_ROW]],
        blocks: [],
        platforms: [],
        crates: [],
        enemies: [],
        locks: [],
        start: [3, 11],
        goal: 59,
        ...over
    };
}

/** mask 를 n 틱 넣고 일어난 일을 모은다 */
function run(g: Game, mask: number, n: number): StepEvent[] {
    const all: StepEvent[] = [];
    for (let k = 0; k < n && !g.over; k++) all.push(...step(g, mask));
    return all;
}

/** 무적으로 n 틱 */
function runInvuln(g: Game, mask: number, n: number): StepEvent[] {
    const all: StepEvent[] = [];
    for (let k = 0; k < n && !g.over; k++) {
        g.player.invuln = 1_000_000;
        all.push(...step(g, mask));
    }
    return all;
}

function count(ev: StepEvent[], type: StepEvent['type']): number {
    return ev.filter((e) => e.type === type).length;
}

/** 시험용 난수 (테스트 쪽 입력 만들기) */
function testRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    };
}

/** 오른쪽으로 치우친 무작위 입력으로 한 판 (같은 입력 seed → 같은 입력) */
function playRandom(seed: number, inputSeed: number, ticks: number): Game {
    const g = createGame(seed);
    const rand = testRng(inputSeed);
    let mask = 0;
    for (let t = 0; t < ticks && !g.over; t++) {
        if (t % 12 === 0) {
            const r = rand();
            mask = 0;
            if (r % 10 < 7) mask |= BTN_RIGHT;
            else if (r % 10 === 7) mask |= BTN_LEFT;
            if ((r >>> 4) % 3 === 0) mask |= BTN_JUMP;
            if ((r >>> 6) % 2 === 0) mask |= BTN_FIRE;
            if ((r >>> 8) % 9 === 0) mask |= BTN_GRENADE;
            if ((r >>> 10) % 7 === 0) mask |= BTN_UP;
            if ((r >>> 12) % 11 === 0) mask |= BTN_DOWN;
        }
        step(g, mask);
    }
    return g;
}

/** 대원을 땅 위 col 열로 옮긴다 (높이는 그대로) */
function teleport(g: Game, col: number): void {
    g.player.x = col * TILE_U + 2 * S;
    g.player.prevX = g.player.x;
}

function body(x: number, y: number): Body {
    return { x, y, w: PLAYER_W * S, h: PLAYER_H * S, vx: 0, vy: 0, onGround: false };
}

describe('타일 충돌', () => {
    it('최대 낙하 속도는 타일 한 칸보다 작다 (한 틱에 바닥을 건너뛸 수 없다)', () => {
        expect(MAX_FALL).toBeLessThan(TILE_U);
    });

    it('어느 높이에서 떨어져도 바닥 위에 정확히 선다 (바닥 뚫림 없음)', () => {
        const { map } = buildMap(flat());
        for (let px = 0; px <= 160; px += 3) {
            const b = body(48 * S, px * S);
            for (let k = 0; k < 300; k++) {
                b.vy = Math.min(b.vy + 64, MAX_FALL);
                moveY(map, b, b.vy);
            }
            expect(b.y + b.h).toBe(GROUND_Y);
            expect(b.onGround).toBe(true);
            expect(boxHitsSolid(map, b.x, b.y, b.w, b.h)).toBe(false);
        }
    });

    it('벽에 딱 붙어 멈추고, 반대쪽으로는 바로 떨어진다 (벽 끼임 없음)', () => {
        const { map } = buildMap(flat({ blocks: [[10, 10, 1, 2]] }));
        const b = body(7 * TILE_U, GROUND_Y - PLAYER_H * S);
        for (let k = 0; k < 100; k++) moveX(map, b, 384);
        expect(b.x + b.w).toBe(10 * TILE_U);
        expect(boxHitsSolid(map, b.x, b.y, b.w, b.h)).toBe(false);
        const before = b.x;
        moveX(map, b, -384);
        expect(b.x).toBe(before - 384);
        // 왼쪽 벽도 같다
        for (let k = 0; k < 400; k++) moveX(map, b, -384);
        expect(b.x).toBe(0);
    });

    it('공중에서 벽을 밀고 있어도 미끄러져 바닥까지 떨어진다', () => {
        const g = createGame(1, flat({ blocks: [[10, 2, 1, 10]] }));
        const p = g.player;
        p.x = 10 * TILE_U - p.w;
        p.y = 3 * TILE_U;
        run(g, BTN_RIGHT, 120);
        expect(p.onGround).toBe(true);
        expect(feetY(p)).toBe(GROUND_Y);
        expect(p.x + p.w).toBe(10 * TILE_U);
    });

    it('머리 위 천장에 닿으면 멈추고 다시 떨어진다', () => {
        const g = createGame(1, flat({ blocks: [[2, 9, 4, 1]] }));
        run(g, 0, 3);
        const ev = run(g, BTN_JUMP, 60);
        expect(count(ev, 'jump')).toBe(1);
        // 천장 아래 면(10줄 위)보다 위로 올라가지 않는다
        expect(g.player.onGround).toBe(true);
        expect(feetY(g.player)).toBe(GROUND_Y);
    });

    it('발판은 아래에서 뚫고 올라가 위에 서고, 엎드려 점프하면 아래로 내려간다', () => {
        const g = createGame(1, flat({ platforms: [[1, 9, 6]] }));
        const p = g.player;
        run(g, 0, 5);
        expect(feetY(p)).toBe(GROUND_Y);
        run(g, BTN_JUMP, 60);
        expect(p.onGround).toBe(true);
        expect(feetY(p)).toBe(9 * TILE_U);
        expect(tileAt(g.map, 4, 9)).toBe(T_PLATFORM);
        // 엎드린 채 점프 → 발판 아래로
        run(g, BTN_DOWN, 3);
        expect(p.crouch).toBe(true);
        run(g, BTN_DOWN | BTN_JUMP, 1);
        run(g, 0, 60);
        expect(p.onGround).toBe(true);
        expect(feetY(p)).toBe(GROUND_Y);
    });

    it('엎드리면 키가 줄고, 일어설 자리가 막혀 있으면 엎드린 채로 있다', () => {
        const g = createGame(1, flat({ blocks: [[5, 10, 3, 1]] }));
        const p = g.player;
        run(g, 0, 3);
        run(g, BTN_DOWN, 2);
        expect(p.crouch).toBe(true);
        expect(feetY(p)).toBe(GROUND_Y);
        // 엎드려 기어서 낮은 천장(11줄만 비어 있음) 아래로
        run(g, BTN_DOWN | BTN_RIGHT, 40);
        expect(p.crouch).toBe(true);
        expect(boxHitsSolid(g.map, p.x, p.y, p.w, p.h)).toBe(false);
        // ↓ 를 떼도 머리 위가 막혀 있어 일어서지 못한다
        run(g, 0, 2);
        expect(p.crouch).toBe(true);
        expect(boxHitsSolid(g.map, p.x, p.y, p.w, p.h)).toBe(false);
    });
});

describe('점프', () => {
    /** hold 틱 동안 점프를 누르고 착지까지 — 가장 높이 오른 높이(px) */
    function peakFor(hold: number): number {
        const g = createGame(1, flat());
        run(g, 0, 3);
        const y0 = feetY(g.player);
        let top = y0;
        for (let t = 0; t < 120; t++) {
            step(g, t < hold ? BTN_JUMP : 0);
            top = Math.min(top, feetY(g.player));
        }
        expect(g.player.onGround).toBe(true);
        expect(feetY(g.player)).toBe(y0);
        return (y0 - top) / S;
    }

    it('끝까지 누르면 약 3칸(48px 이상) 올라가고 같은 높이에 내려앉는다', () => {
        const h = peakFor(80);
        expect(h).toBeGreaterThanOrEqual(48);
        expect(h).toBeLessThanOrEqual(60);
    });

    it('누르는 길이에 따라 높이가 달라진다 (짧게 = 낮게)', () => {
        const holds = [1, 3, 6, 10, 15, 21];
        const peaks = holds.map(peakFor);
        expect(peaks[0]).toBeLessThan(20);
        for (let k = 1; k < peaks.length; k++)
            expect(peaks[k]).toBeGreaterThanOrEqual(peaks[k - 1]);
        expect(peaks[peaks.length - 1]).toBeGreaterThanOrEqual(48);
    });

    it('공중에서는 다시 뛰지 않는다', () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        const ev: StepEvent[] = [];
        // 10틱 누르고 2틱 떼었다가 공중에서 다시 누른다
        for (let t = 0; t < 14; t++) ev.push(...step(g, t < 10 || t >= 12 ? BTN_JUMP : 0));
        expect(g.player.onGround).toBe(false);
        // 첫 점프 뒤 착지 전까지 누른 점프는 무시된다
        expect(count(ev, 'jump')).toBe(1);
    });

    it('달리기는 1.5px/틱, 엎드려 기기는 그 절반', () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        const x0 = g.player.x;
        run(g, BTN_RIGHT, 10);
        expect(g.player.x - x0).toBe(10 * 384);
        const x1 = g.player.x;
        run(g, BTN_RIGHT | BTN_DOWN, 10);
        expect(g.player.x - x1).toBeLessThan(10 * 384);
        expect(g.player.crouch).toBe(true);
    });
});

describe('결정성', () => {
    it('같은 seed + 같은 입력이면 상태가 똑같다', () => {
        const a = playRandom(7, 99, 3000);
        const b = playRandom(7, 99, 3000);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(a.tick).toBeGreaterThan(200);
    });

    it('seed 가 다르면 적의 사격 간격이 다르다', () => {
        const a = createGame(1);
        const b = createGame(2);
        teleport(a, 33);
        teleport(b, 33);
        runInvuln(a, BTN_RIGHT, 400);
        runInvuln(b, BTN_RIGHT, 400);
        expect(a.enemies.length).toBeGreaterThan(0);
        expect(JSON.stringify(a.enemies.map((e) => e.fireT))).not.toBe(
            JSON.stringify(b.enemies.map((e) => e.fireT))
        );
    });

    it('기록으로 다시 돌리면(replay) 같은 판이 나온다', () => {
        const g = playRandom(12345, 7, 4000);
        const r = replay(12345, g.log, g.tick);
        expect(r.ok).toBe(true);
        expect(r.error).toBe('');
        expect(JSON.stringify(r.game)).toBe(JSON.stringify(g));
    });

    it('상태에는 정수만 들어간다 (불리언·글자 제외)', () => {
        const g = playRandom(3, 4, 2000);
        const bad: string[] = [];
        const walk = (v: unknown, path: string) => {
            if (typeof v === 'number') {
                if (!Number.isSafeInteger(v)) bad.push(`${path}=${v}`);
            } else if (Array.isArray(v)) {
                v.forEach((x, i) => walk(x, `${path}[${i}]`));
            } else if (v && typeof v === 'object') {
                for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
            }
        };
        walk(g, 'g');
        expect(bad).toEqual([]);
    });

    it('입력 기록은 버튼 묶음이 바뀐 틱만 남긴다', () => {
        const g = createGame(1, flat());
        const masks = [0, 0, BTN_RIGHT, BTN_RIGHT, BTN_RIGHT | BTN_FIRE, 0, 0];
        for (const m of masks) step(g, m);
        expect(g.log.inputs).toEqual([2, BTN_RIGHT, 4, BTN_RIGHT | BTN_FIRE, 5, 0]);
    });

    it('반대 방향을 함께 누르면 없는 것으로 친다', () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        const x0 = g.player.x;
        run(g, BTN_LEFT | BTN_RIGHT | BTN_UP | BTN_DOWN, 10);
        expect(g.player.x).toBe(x0);
        expect(g.log.inputs).toEqual([]);
    });

    it('어긋난 기록은 거부한다', () => {
        expect(replay(1, { inputs: [1] }, 10).error).toBe('bad-log');
        expect(replay(1, { inputs: [0.5, 1] }, 10).error).toBe('bad-log');
        expect(replay(1, { inputs: [] }, -1).error).toBe('bad-ticks');
        expect(replay(1, { inputs: [] }, MAX_TICKS + 1).error).toBe('bad-ticks');
        expect(replay(1, { inputs: [5, 1, 3, 2] }, 10).error).toBe('tick-order');
        expect(replay(1, { inputs: [5, 1, 5, 2] }, 10).error).toBe('tick-order');
        expect(replay(1, { inputs: [0, BTN_LEFT | BTN_RIGHT] }, 10).error).toBe('mask-range');
        expect(replay(1, { inputs: [0, 128] }, 10).error).toBe('mask-range');
        expect(replay(1, { inputs: [0, -1] }, 10).error).toBe('mask-range');
        expect(replay(1, { inputs: [0, 0] }, 10).error).toBe('mask-unchanged');
        expect(replay(1, { inputs: [0, 2, 3, 2] }, 10).error).toBe('mask-unchanged');
        expect(replay(1, { inputs: [10, 1] }, 5).error).toBe('tick-range');
        expect(replay(1, { inputs: [] }, 0).ok).toBe(true);
    });
});

describe('동시 객체 상한', () => {
    const crowd = flat({
        // 한 칸에 둘씩 — 처음부터 모두 화면 안
        enemies: Array.from({ length: 30 }, (_, k) => ({
            kind: ENEMY_DUMMY,
            col: 6 + (k >> 1),
            row: 11
        }))
    });

    it(`적은 ${MAX_ENEMIES} 을 넘지 않는다 (나머지는 자리가 나면 나온다)`, () => {
        const g = createGame(1, crowd);
        let most = 0;
        for (let t = 0; t < 1500 && !g.over; t++) {
            g.player.invuln = 1_000_000;
            step(g, BTN_FIRE);
            most = Math.max(most, g.enemies.length);
            expect(g.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
        }
        expect(most).toBe(MAX_ENEMIES);
        // 잡을수록 자리가 나서 나머지가 나온다
        expect(g.kills).toBeGreaterThan(MAX_ENEMIES);
    });

    it(`총알(내 것 + 적)은 ${MAX_BULLETS} 을 넘지 않는다`, () => {
        const g = createGame(1, flat());
        let made = 0;
        for (let k = 0; k < 200; k++) {
            if (spawnBullet(g, OWNER_ENEMY, 300 * S, 50 * S, 0, 0)) made++;
        }
        expect(made).toBe(MAX_BULLETS);
        expect(g.bullets.length).toBe(MAX_BULLETS);

        const busy = createGame(5, crowd);
        for (let t = 0; t < 2000 && !busy.over; t++) {
            busy.player.invuln = 1_000_000;
            step(busy, t % 3 === 0 ? 0 : BTN_FIRE | BTN_UP);
            expect(busy.bullets.length).toBeLessThanOrEqual(MAX_BULLETS);
        }
    });

    it(`날아가는 수류탄은 ${MAX_GRENADES} 개까지, 가진 수는 0 아래로 내려가지 않는다`, () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        for (let t = 0; t < 600; t++) {
            step(g, t % 2 === 0 ? BTN_GRENADE : 0);
            expect(g.grenades.length).toBeLessThanOrEqual(MAX_GRENADES);
            expect(g.player.grenades).toBeGreaterThanOrEqual(0);
        }
        expect(g.player.grenades).toBe(0);
    });

    it('화면 밖으로 나간 총알은 지운다', () => {
        const g = createGame(1, flat());
        spawnBullet(g, OWNER_ENEMY, 200 * S, 20 * S, -ENEMY_BULLET_SPEED, 0);
        run(g, 0, 200);
        expect(g.bullets.length).toBe(0);
    });
});

describe('목숨', () => {
    /** 대원 몸 한가운데에 적 총알을 놓는다 */
    function shoot(g: Game): void {
        const p = g.player;
        spawnBullet(g, OWNER_ENEMY, centerX(p), p.y + (p.h >> 1), 0, 0);
    }

    it('맞으면 목숨 −1, 잠시 뒤 다시 나와 한동안 무적, 수류탄은 다시 10개', () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        run(g, BTN_GRENADE, 1);
        expect(g.player.grenades).toBe(START_GRENADES - 1);
        shoot(g);
        const ev = run(g, 0, 1);
        expect(count(ev, 'die')).toBe(1);
        expect(g.lives).toBe(START_LIVES - 1);
        expect(g.player.dead).toBeGreaterThan(0);
        const back = run(g, 0, DEATH_TICKS);
        expect(count(back, 'respawn')).toBe(1);
        expect(g.player.dead).toBe(0);
        expect(g.player.invuln).toBeGreaterThan(INVULN_TICKS - 5);
        expect(g.player.grenades).toBe(START_GRENADES);
        // 무적 동안은 맞지 않는다
        shoot(g);
        run(g, 0, 1);
        expect(g.lives).toBe(START_LIVES - 1);
        // 다시 나와서는 땅에 내려선다
        run(g, 0, 120);
        expect(g.player.onGround).toBe(true);
    });

    it('세 번 맞으면 판이 끝난다', () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        for (let k = 0; k < START_LIVES; k++) {
            g.player.invuln = 0;
            shoot(g);
            run(g, 0, 1);
            run(g, 0, DEATH_TICKS);
        }
        expect(g.lives).toBe(0);
        expect(g.over).toBe(true);
        expect(g.reason).toBe('lives');
    });

    it('구덩이에 떨어지면 목숨 −1', () => {
        const g = createGame(
            1,
            flat({
                ground: [
                    [0, 9, GROUND_ROW],
                    [14, 59, GROUND_ROW]
                ]
            })
        );
        let died = -1;
        for (let t = 0; t < 200 && died < 0; t++) {
            if (step(g, BTN_RIGHT).some((e) => e.type === 'die')) died = t;
        }
        expect(died).toBeGreaterThan(0);
        expect(g.lives).toBe(START_LIVES - 1);
    });

    it('엎드리면 머리 높이로 날아오는 총알을 피한다', () => {
        const g = createGame(1, flat());
        run(g, BTN_DOWN, 5);
        const p = g.player;
        expect(p.crouch).toBe(true);
        // 서 있을 때 머리 높이(발에서 18px 위)로 지나가는 총알
        spawnBullet(g, OWNER_ENEMY, centerX(p) + 40 * S, feetY(p) - 18 * S, -ENEMY_BULLET_SPEED, 0);
        run(g, BTN_DOWN, 60);
        expect(g.lives).toBe(START_LIVES);
    });
});

describe('상자·수류탄', () => {
    it('상자는 권총 세 발에 부서지고 점수가 오른다', () => {
        const g = createGame(1, flat({ crates: [[8, 11]] }));
        expect(tileAt(g.map, 8, 11)).toBe(3);
        const ev = run(g, BTN_FIRE, 120);
        expect(count(ev, 'crate-hit')).toBe(2);
        expect(count(ev, 'crate-break')).toBe(1);
        expect(tileAt(g.map, 8, 11)).toBe(T_EMPTY);
        expect(g.score).toBe(CRATE_POINTS);
    });

    it('상자는 총알을 막는다 (뒤의 적은 상자가 부서질 때까지 맞지 않는다)', () => {
        const g = createGame(
            1,
            flat({ crates: [[8, 11]], enemies: [{ kind: ENEMY_DUMMY, col: 10, row: 11 }] })
        );
        const ev = runInvuln(g, BTN_FIRE, 40);
        expect(count(ev, 'crate-break')).toBe(1);
        const firstKillOrHit = ev.findIndex((e) => e.type === 'hit' || e.type === 'kill');
        const brokeAt = ev.findIndex((e) => e.type === 'crate-break');
        expect(firstKillOrHit === -1 || firstKillOrHit > brokeAt).toBe(true);
    });

    it('수류탄은 10개 — 다 쓰면 더 나가지 않는다', () => {
        const g = createGame(1, flat());
        run(g, 0, 3);
        let thrown = 0;
        for (let k = 0; k < 14; k++) {
            thrown += count(run(g, BTN_GRENADE, 1), 'throw');
            run(g, 0, 40);
        }
        expect(thrown).toBe(START_GRENADES);
        expect(g.player.grenades).toBe(0);
    });

    it('수류탄 폭발은 상자를 부수고 적을 잡는다', () => {
        const g = createGame(
            1,
            flat({ crates: [[8, 11]], enemies: [{ kind: ENEMY_DUMMY, col: 12, row: 11 }] })
        );
        runInvuln(g, 0, 3);
        const ev1 = runInvuln(g, BTN_GRENADE, 1);
        ev1.push(...runInvuln(g, 0, 100));
        expect(count(ev1, 'boom')).toBe(1);
        expect(tileAt(g.map, 8, 11)).toBe(T_EMPTY);

        const h = createGame(1, flat({ enemies: [{ kind: ENEMY_DUMMY, col: 8, row: 11 }] }));
        runInvuln(h, 0, 3);
        const ev2 = runInvuln(h, BTN_GRENADE, 1);
        ev2.push(...runInvuln(h, 0, 100));
        expect(count(ev2, 'kill')).toBe(1);
        expect(h.kills).toBe(1);
    });
});

describe('카메라·잠금 구간', () => {
    it('카메라는 오른쪽으로만 가고, 대원은 화면 왼쪽 밖으로 못 나간다', () => {
        const g = createGame(1);
        let last = g.camX;
        for (let t = 0; t < 900; t++) {
            g.player.invuln = 1_000_000;
            step(g, t < 500 ? BTN_RIGHT : BTN_LEFT);
            expect(g.camX).toBeGreaterThanOrEqual(last);
            expect(g.player.x).toBeGreaterThanOrEqual(g.camX);
            last = g.camX;
        }
        expect(g.camX).toBeGreaterThan(0);
    });

    it('잠금 구간에서는 나온 적을 다 잡아야 카메라가 다시 간다', () => {
        const g = createGame(1);
        const lockAt = TEST_STAGE.locks[0] * TILE_U;
        // 상자를 넘어 첫 잠금 구간 안으로 옮겨 놓는다
        teleport(g, 40);
        const ev = runInvuln(g, BTN_RIGHT, 30);
        expect(count(ev, 'lock')).toBe(1);
        expect(g.locked).toBe(true);
        expect(g.camX).toBe(lockAt);
        // 화면 오른쪽 끝 밖으로도 못 간다
        expect(g.player.x + g.player.w).toBeLessThanOrEqual(g.camX + VIEW_W * S);
        expect(g.enemies.length).toBeGreaterThan(0);
        for (const e of g.enemies) e.hp = 0;
        const ev2 = runInvuln(g, BTN_RIGHT, 2);
        expect(count(ev2, 'unlock')).toBe(1);
        expect(g.locked).toBe(false);
        runInvuln(g, BTN_RIGHT, 60);
        expect(g.camX).toBeGreaterThan(lockAt);
    });
});

describe('시험 구간', () => {
    const { map } = buildMap(TEST_STAGE);

    it('적은 모두 땅이나 발판 위에 서 있고, 출발 자리는 비어 있다', () => {
        for (const e of TEST_STAGE.enemies) {
            expect(isSolid(tileAt(map, e.col, e.row))).toBe(false);
            const below = tileAt(map, e.col, e.row + 1);
            expect(below === T_SOLID || below === T_PLATFORM).toBe(true);
        }
        const [c, r] = TEST_STAGE.start;
        expect(tileAt(map, c, r)).toBe(T_EMPTY);
        expect(tileAt(map, c, r + 1)).toBe(T_SOLID);
    });

    it('잠금 구간마다 화면 안에 적이 있다', () => {
        const screen = VIEW_W / TILE;
        for (const lock of TEST_STAGE.locks) {
            const inside = TEST_STAGE.enemies.filter((e) => e.col >= lock && e.col < lock + screen);
            expect(inside.length).toBeGreaterThan(0);
        }
        expect(TEST_STAGE.goal).toBeLessThan(TEST_STAGE.cols);
    });

    it('높이 차이는 점프로 오를 수 있다 (바위·발판은 땅에서 3칸 이하)', () => {
        for (const [, r] of TEST_STAGE.blocks) expect(GROUND_ROW - r).toBeLessThanOrEqual(3);
        for (const [, r] of TEST_STAGE.platforms) expect(GROUND_ROW - r).toBeGreaterThan(0);
    });

    /**
     * 무적 봇: 가장 가까운 적에게 다가가 쏜다. 적이 머리 위(발판)에 있으면 그 아래에서 위로 쏜다.
     * 막히면 뛰어넘는다. 적이 없으면 오른쪽으로.
     */
    function botMask(g: Game, stuck: boolean): number {
        const p = g.player;
        if (p.dead > 0) return 0;
        const cx = centerX(p);
        let target: Enemy | null = null;
        let best = Infinity;
        for (const e of g.enemies) {
            const d = Math.abs(e.x + (e.w >> 1) - cx);
            if (d < best) {
                best = d;
                target = e;
            }
        }
        let m = BTN_FIRE;
        if (!target) return m | BTN_RIGHT;
        const ecx = target.x + (target.w >> 1);
        const above = target.y + target.h < p.y - 8 * S;
        if (above) {
            const inRight = cx >= ecx - 11 * S && cx <= ecx - 3 * S;
            const inLeft = cx >= ecx + 3 * S && cx <= ecx + 11 * S;
            if ((p.facing === 1 && inRight) || (p.facing === -1 && inLeft)) m |= BTN_UP;
            else if (cx < ecx - 11 * S) m |= BTN_RIGHT;
            else if (cx > ecx + 11 * S) m |= BTN_LEFT;
            else if (cx < ecx) m |= cx > ecx - 3 * S ? BTN_LEFT : BTN_RIGHT;
            else m |= cx < ecx + 3 * S ? BTN_RIGHT : BTN_LEFT;
        } else {
            const dx = ecx - cx;
            if (Math.abs(dx) > 40 * S || Math.sign(dx) !== p.facing) {
                m |= dx > 0 ? BTN_RIGHT : BTN_LEFT;
            }
        }
        if (stuck && (m & (BTN_LEFT | BTN_RIGHT)) !== 0) m |= BTN_JUMP;
        return m;
    }

    it('무적 봇이 시험 구간 끝까지 갈 수 있다', () => {
        const g = createGame(2024);
        let jumpHold = 0;
        let lastX = g.player.x;
        let stuckTicks = 0;
        for (let t = 0; t < MAX_TICKS && !g.over; t++) {
            g.player.invuln = 1_000_000;
            const p = g.player;
            stuckTicks = p.onGround && p.x === lastX ? stuckTicks + 1 : 0;
            lastX = p.x;
            let m = botMask(g, stuckTicks > 2);
            if (jumpHold > 0) {
                m |= BTN_JUMP;
                jumpHold--;
            } else if ((m & BTN_JUMP) !== 0) {
                if ((g.prevMask & BTN_JUMP) !== 0) m &= ~BTN_JUMP;
                else jumpHold = 20;
            }
            step(g, m);
        }
        expect(g.reason).toBe('clear');
        expect(g.kills).toBe(TEST_STAGE.enemies.length);
        expect(g.tick).toBeLessThan(5 * 60 * 60);
    });
});

describe('입력', () => {
    it('가상 패드는 8방향 — 가운데 가까우면 없음', () => {
        expect(padBits(0, 0, 10)).toBe(0);
        expect(padBits(5, 5, 10)).toBe(0);
        expect(padBits(40, 0, 10)).toBe(BTN_RIGHT);
        expect(padBits(-40, 0, 10)).toBe(BTN_LEFT);
        expect(padBits(0, -40, 10)).toBe(BTN_UP);
        expect(padBits(0, 40, 10)).toBe(BTN_DOWN);
        expect(padBits(30, 30, 10)).toBe(BTN_RIGHT | BTN_DOWN);
        expect(padBits(-30, -30, 10)).toBe(BTN_LEFT | BTN_UP);
        // 22.5° 경계 안쪽은 한 방향
        expect(padBits(40, 10, 10)).toBe(BTN_RIGHT);
        expect(padBits(10, -40, 10)).toBe(BTN_UP);
    });
});

describe('그림', () => {
    const colors = Object.keys(PALETTE);

    it('공용 팔레트는 16색 이내, 모두 #rrggbb', () => {
        expect(colors.length).toBeLessThanOrEqual(16);
        for (const c of Object.values(PALETTE)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
        expect(colors).not.toContain('.');
    });

    function checkArt(art: string[], w: number, h: number) {
        expect(art.length).toBe(h);
        for (const row of art) {
            expect(row.length).toBe(w);
            for (const ch of row) expect(ch === '.' || colors.includes(ch)).toBe(true);
        }
    }

    it('대원은 윗몸 × 다리 어느 조합이든 24×24', () => {
        for (const upper of [UPPER_FORWARD, UPPER_UP]) {
            checkArt(upper, CHAR_SIZE, 14);
            for (const legs of [LEGS_STAND, ...LEGS_RUN, ...LEGS_JUMP]) {
                checkArt(legs, CHAR_SIZE, 10);
                checkArt(composeSoldier(upper, legs), CHAR_SIZE, CHAR_SIZE);
            }
            for (const c of LEGS_CROUCH) {
                checkArt(c, CHAR_SIZE, 2);
                checkArt(composeSoldier(upper, null, c), CHAR_SIZE, CHAR_SIZE);
            }
        }
        expect(LEGS_RUN.length).toBe(4);
        expect(LEGS_JUMP.length).toBe(2);
        expect(LEGS_CROUCH.length).toBe(2);
    });

    it('적은 24×24, 타일은 16×16, 작은 것은 6×6', () => {
        checkArt(ART.dummy, CHAR_SIZE, CHAR_SIZE);
        for (const k of ['grass', 'dirt', 'platform', 'crate', 'crack']) {
            checkArt(ART[k], TILE_SIZE, TILE_SIZE);
        }
        checkArt(ART.grenade, 6, 6);
        checkArt(ART.muzzle, 6, 6);
    });
});

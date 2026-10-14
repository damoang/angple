/**
 * 다모앙 특공대 엔진 테스트 — 타일 충돌(바닥 뚫림·벽 끼임 없음·한쪽 발판), 점프 높이(누른 길이),
 * 결정성·재연·정수 상태, 동시 객체 상한, 목숨·재등장 무적, 상자·수류탄, 카메라·잠금 구간,
 * 적(보병·투척병: 등장·걷기·공격·처치·점수, 수류탄 포물선 결정성, 엎드려 피하기),
 * 보스(등장·잠금·예고 3가지·피하기·체력·쓰러짐·점수 내역·결정성),
 * 1단계 구간 데이터와 보스까지 깰 수 있는지(무적 봇), 난이도(초보 봇 12판 — 첫 판에 보스까지), 그림 데이터(크기·팔레트)
 */
import { describe, it, expect } from 'vitest';
import {
    ATTACK_LOB,
    ATTACK_SHOT,
    BLAST_DAMAGE,
    BOSS_ACT,
    BOSS_DOWN,
    BOSS_ENTER,
    BOSS_GUN_SHOTS,
    BOSS_H,
    BOSS_HIT_H,
    BOSS_IDLE,
    BOSS_POINTS,
    BOSS_W,
    BOSS_WINDUP_MODE,
    BULLET_HALF,
    CROUCH_H,
    CRATE_POINTS,
    DEATH_TICKS,
    ENEMY_BULLET_SPEED,
    ENEMY_SHOT_Y,
    GRAVITY,
    INVULN_TICKS,
    LIFE_BONUS,
    LOB_SPREAD,
    MAX_BULLETS,
    MAX_ENEMIES,
    MAX_ENEMY_GRENADES,
    MAX_FALL,
    MAX_GRENADES,
    MAX_TICKS,
    MODE_RECOVER,
    MODE_WINDUP,
    OWNER_ENEMY,
    OWNER_PLAYER,
    PATTERN_CHARGE,
    PATTERN_GUN,
    PATTERN_MORTAR,
    PLAYER_H,
    PLAYER_W,
    START_GRENADES,
    START_LIVES,
    TICK_HZ,
    TIME_POINTS,
    VIEW_W,
    bossBox,
    bossChargeStop,
    bossHittable,
    bossLockX,
    centerX,
    countGrenades,
    createGame,
    enemySpec,
    feetY,
    muzzle,
    replay,
    spawnBullet,
    spawnEnemy,
    startBossPattern,
    step,
    timeLeft,
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
    fdiv,
    isSolid,
    moveX,
    moveY,
    onPlatformOnly,
    tileAt,
    type Body
} from './physics';
import {
    ENEMY_DUMMY,
    ENEMY_RIFLE,
    ENEMY_THROWER,
    STAGES,
    STAGE_1,
    buildMap,
    type StageDef
} from './stages';
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
    AIR_DOWN,
    ART,
    BOSS,
    CHAR_SIZE,
    ENEMY_LEGS_STAND,
    ENEMY_LEGS_WALK,
    LEGS_CROUCH,
    LEGS_JUMP,
    LEGS_RUN,
    LEGS_STAND,
    PALETTE,
    RIFLE_AIM,
    RIFLE_TOP,
    THROWER_TOP,
    THROWER_WINDUP,
    TILE_SIZE,
    UPPER_FORWARD,
    UPPER_UP,
    composeEnemy,
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
function playRandom(
    seed: number,
    inputSeed: number,
    ticks: number,
    stage: StageDef | number = 0
): Game {
    const g = createGame(seed, stage);
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
        const r = replay(12345, g.log, g.tick, 0);
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
        expect(replay(1, { inputs: [1] }, 10, 0).error).toBe('bad-log');
        expect(replay(1, { inputs: [0.5, 1] }, 10, 0).error).toBe('bad-log');
        expect(replay(1, { inputs: [] }, -1, 0).error).toBe('bad-ticks');
        expect(replay(1, { inputs: [] }, MAX_TICKS + 1, 0).error).toBe('bad-ticks');
        expect(replay(1, { inputs: [5, 1, 3, 2] }, 10, 0).error).toBe('tick-order');
        expect(replay(1, { inputs: [5, 1, 5, 2] }, 10, 0).error).toBe('tick-order');
        expect(replay(1, { inputs: [0, BTN_LEFT | BTN_RIGHT] }, 10, 0).error).toBe('mask-range');
        expect(replay(1, { inputs: [0, 128] }, 10, 0).error).toBe('mask-range');
        expect(replay(1, { inputs: [0, -1] }, 10, 0).error).toBe('mask-range');
        expect(replay(1, { inputs: [0, 0] }, 10, 0).error).toBe('mask-unchanged');
        expect(replay(1, { inputs: [0, 2, 3, 2] }, 10, 0).error).toBe('mask-unchanged');
        expect(replay(1, { inputs: [10, 1] }, 5, 0).error).toBe('tick-range');
        expect(replay(1, { inputs: [] }, 0, 0).ok).toBe(true);
    });

    it('없는 스테이지 번호는 거부한다', () => {
        expect(replay(1, { inputs: [] }, 10, -1).error).toBe('bad-stage');
        expect(replay(1, { inputs: [] }, 10, STAGES.length).error).toBe('bad-stage');
        expect(replay(1, { inputs: [] }, 10, 0.5).error).toBe('bad-stage');
        expect(replay(1, { inputs: [] }, 10, Number.NaN).error).toBe('bad-stage');
        expect(replay(1, { inputs: [] }, 10, 0).ok).toBe(true);
        expect(() => createGame(1, STAGES.length)).toThrow(RangeError);
        expect(createGame(1).stageId).toBe(0);
        expect(createGame(1, 0).stage).toBe(STAGE_1);
        expect(createGame(1, flat()).stageId).toBe(-1);
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

    it(`보병·투척병이 몰려도 적 ${MAX_ENEMIES}·총알 ${MAX_BULLETS}·적 수류탄 ${MAX_ENEMY_GRENADES} 을 넘지 않는다`, () => {
        const mixed = flat({
            enemies: Array.from({ length: 30 }, (_, k) => ({
                kind: k % 2 === 0 ? ENEMY_RIFLE : ENEMY_THROWER,
                col: 6 + (k >> 1),
                row: 11
            }))
        });
        const g = createGame(9, mixed);
        let mostEnemies = 0;
        let mostBombs = 0;
        for (let t = 0; t < 2400 && !g.over; t++) {
            g.player.invuln = 1_000_000;
            step(g, t % 4 === 0 ? 0 : BTN_FIRE);
            mostEnemies = Math.max(mostEnemies, g.enemies.length);
            mostBombs = Math.max(mostBombs, countGrenades(g, OWNER_ENEMY));
            expect(g.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
            expect(g.bullets.length).toBeLessThanOrEqual(MAX_BULLETS);
            expect(countGrenades(g, OWNER_ENEMY)).toBeLessThanOrEqual(MAX_ENEMY_GRENADES);
            expect(countGrenades(g, OWNER_PLAYER)).toBeLessThanOrEqual(MAX_GRENADES);
        }
        expect(mostEnemies).toBe(MAX_ENEMIES);
        expect(mostBombs).toBeGreaterThan(0);
        expect(g.kills).toBeGreaterThan(MAX_ENEMIES);
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

    it('서 있는 적 총알 높이는 엎드린 머리 위·서 있는 몸 안이다', () => {
        // 총알 아래 가장자리(발에서 ENEMY_SHOT_Y − BULLET_HALF)가 엎드린 키보다 높다
        expect(ENEMY_SHOT_Y - BULLET_HALF).toBeGreaterThan(CROUCH_H);
        // 총알 위 가장자리는 서 있는 키 안
        expect(ENEMY_SHOT_Y + BULLET_HALF).toBeLessThanOrEqual(PLAYER_H);
    });

    /** 보병 하나와 마주 서서 mask 를 누르고 있는다 — 처음 맞을 때까지 (최대 900틱) */
    function duel(mask: number) {
        const g = createGame(1, flat({ enemies: [{ kind: ENEMY_RIFLE, col: 12, row: 11 }] }));
        run(g, mask, 3);
        let shots = 0;
        let passed = false;
        for (let t = 0; t < 900 && g.lives === START_LIVES; t++) {
            shots += count(step(g, mask), 'enemy-shot');
            for (const b of g.bullets) {
                if (b.owner === OWNER_ENEMY && b.x < g.player.x) passed = true;
            }
        }
        return { g, shots, passed };
    }

    it('엎드리면 보병이 실제로 쏜 총알이 머리 위로 지나가고, 서 있으면 맞는다', () => {
        const low = duel(BTN_DOWN);
        expect(low.g.player.crouch).toBe(true);
        expect(low.shots).toBeGreaterThanOrEqual(2);
        expect(low.passed).toBe(true);
        expect(low.g.lives).toBe(START_LIVES);

        const high = duel(0);
        expect(high.shots).toBeGreaterThanOrEqual(1);
        expect(high.g.lives).toBe(START_LIVES - 1);
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

describe('적', () => {
    /** 보병·투척병 하나가 있는 평지 (대원은 3열, 적은 col 열 땅 위) */
    function withEnemy(kind: number, col: number, over: Partial<StageDef> = {}): Game {
        return createGame(1, flat({ enemies: [{ kind, col, row: 11 }], ...over }));
    }

    it('종류마다 첫 공격 시각·체력이 규격대로다 (모든 종류가 표적병 값을 쓰지 않는다)', () => {
        for (const kind of [ENEMY_DUMMY, ENEMY_RIFLE, ENEMY_THROWER]) {
            const spec = enemySpec(kind);
            for (let seed = 1; seed <= 20; seed++) {
                const g = createGame(seed, flat());
                const e = spawnEnemy(g, kind, 300 * S, GROUND_Y - spec.h * S);
                expect(e).not.toBeNull();
                expect(e!.fireT).toBeGreaterThanOrEqual(spec.first);
                expect(e!.fireT).toBeLessThan(spec.first + Math.max(1, spec.firstSpread));
                expect(e!.hp).toBe(spec.hp);
            }
        }
        expect(enemySpec(ENEMY_RIFLE).first).not.toBe(enemySpec(ENEMY_DUMMY).first);
        expect(enemySpec(ENEMY_THROWER).first).not.toBe(enemySpec(ENEMY_RIFLE).first);
    });

    it('보병은 다가오다 멈춰 겨눈 뒤 곧게 쏘고, 두 발에 쓰러져 100점', () => {
        const g = withEnemy(ENEMY_RIFLE, 20);
        runInvuln(g, 0, 1);
        expect(g.enemies.length).toBe(1);
        const e = g.enemies[0];
        expect(e.kind).toBe(ENEMY_RIFLE);
        const x0 = e.x;
        let windup = false;
        let shot: StepEvent | undefined;
        for (let t = 0; t < 400 && !shot; t++) {
            const ev = runInvuln(g, 0, 1);
            if (e.mode === MODE_WINDUP) {
                windup = true;
                // 겨누는 동안은 멈춰 있다
                expect(e.x).toBe(e.prevX);
            }
            shot = ev.find((v) => v.type === 'enemy-shot');
        }
        // 대원 쪽(왼쪽)으로 걸어왔다
        expect(e.x).toBeLessThan(x0);
        expect(e.facing).toBe(-1);
        expect(windup).toBe(true);
        expect(shot).toBeDefined();
        const b = g.bullets.find((v) => v.owner === OWNER_ENEMY);
        expect(b).toBeDefined();
        expect(e.y + e.h - b!.y).toBe(ENEMY_SHOT_Y * S);
        expect(b!.vx).toBe(-ENEMY_BULLET_SPEED);
        expect(b!.vy).toBe(0);
        // 계속 땅 위에 서 있다 (중력·바닥 충돌)
        expect(e.onGround).toBe(true);
        expect(e.y + e.h).toBe(GROUND_Y);

        const ev = runInvuln(g, BTN_FIRE, 300);
        expect(count(ev, 'hit')).toBeGreaterThanOrEqual(1);
        expect(count(ev, 'kill')).toBe(1);
        expect(g.kills).toBe(1);
        expect(g.score).toBe(enemySpec(ENEMY_RIFLE).points);
        expect(g.enemies.length).toBe(0);
    });

    it('보병은 낭떠러지·벽에서 돌아선다 (떨어지거나 벽을 뚫지 않는다)', () => {
        // 8~13열 바위 언덕(위 = 9줄) 위의 보병, 16열 벽 오른쪽의 보병
        const g = createGame(
            1,
            flat({
                blocks: [
                    [8, 9, 6, 3],
                    [16, 10, 1, 2]
                ],
                enemies: [
                    { kind: ENEMY_RIFLE, col: 10, row: 8 },
                    { kind: ENEMY_RIFLE, col: 19, row: 11 }
                ]
            })
        );
        runInvuln(g, 0, 1);
        const [hill, walled] = [...g.enemies].sort((a, b) => a.x - b.x);
        const seenDirs = new Set<number>();
        for (let t = 0; t < 900; t++) {
            runInvuln(g, 0, 1);
            seenDirs.add(hill.walkDir);
            expect(hill.y + hill.h).toBe(9 * TILE_U);
            expect(hill.x).toBeGreaterThanOrEqual(8 * TILE_U);
            expect(hill.x + hill.w).toBeLessThanOrEqual(14 * TILE_U);
            expect(walled.x).toBeGreaterThanOrEqual(17 * TILE_U);
            expect(walled.y + walled.h).toBe(GROUND_Y);
            expect(boxHitsSolid(g.map, walled.x, walled.y, walled.w, walled.h)).toBe(false);
        }
        // 언덕 끝에서 돌아서 양쪽으로 걸었다
        expect(seenDirs.size).toBe(2);
        expect(g.enemies.length).toBe(2);
    });

    it('보병은 높이가 다른 대원(한 칸 턱 위)에게는 쏘지 않는다', () => {
        const g = createGame(
            1,
            flat({
                blocks: [[0, 11, 8, 1]],
                start: [3, 10],
                enemies: [{ kind: ENEMY_RIFLE, col: 14, row: 11 }]
            })
        );
        const ev = runInvuln(g, 0, 900);
        expect(feetY(g.player)).toBe(11 * TILE_U);
        expect(g.enemies.length).toBe(1);
        expect(count(ev, 'enemy-shot')).toBe(0);
    });

    it('보병은 쏘는 틱에 높이를 다시 본다 — 겨누는 사이 턱 위로 올라간 대원에게는 쏘지 않는다', () => {
        const g = createGame(
            1,
            flat({
                blocks: [[2, 11, 2, 1]],
                start: [6, 11],
                enemies: [{ kind: ENEMY_RIFLE, col: 16, row: 11 }]
            })
        );
        let moved = false;
        let shots = 0;
        let recovered = false;
        for (let t = 0; t < 900 && !recovered; t++) {
            g.player.invuln = 1_000_000;
            shots += count(step(g, 0), 'enemy-shot');
            const e = g.enemies[0];
            if (!moved && e?.mode === MODE_WINDUP) {
                // 겨누기 시작한 뒤 한 칸 턱(16px) 위로 옮긴다 — 총알 높이(발에서 18px)가 대원 발목에 걸리는 자리
                const p = g.player;
                p.x = 2 * TILE_U + 2 * S;
                p.y = 11 * TILE_U - p.h;
                p.prevX = p.x;
                p.prevY = p.y;
                p.vy = 0;
                moved = true;
            }
            if (moved && e?.mode === MODE_RECOVER) recovered = true;
        }
        expect(moved).toBe(true);
        expect(recovered).toBe(true);
        expect(feetY(g.player)).toBe(11 * TILE_U);
        expect(shots).toBe(0);
    });

    it('투척병은 멈춰 팔을 든 뒤 대원 쪽으로 수류탄을 던지고, 가만히 있는 대원은 맞는다', () => {
        const g = withEnemy(ENEMY_THROWER, 14);
        let windup = false;
        let thrown = false;
        for (let t = 0; t < 400 && !thrown; t++) {
            const ev = step(g, 0);
            if (g.enemies[0]?.mode === MODE_WINDUP) windup = true;
            thrown = ev.some((v) => v.type === 'enemy-throw');
        }
        expect(windup).toBe(true);
        expect(thrown).toBe(true);
        expect(countGrenades(g, OWNER_ENEMY)).toBe(1);
        const gr = g.grenades.find((v) => v.owner === OWNER_ENEMY)!;
        expect(gr.vx).toBeLessThan(0);
        expect(gr.vy).toBeLessThan(0);
        const ev = run(g, 0, 120);
        expect(count(ev, 'boom')).toBeGreaterThanOrEqual(1);
        expect(count(ev, 'die')).toBe(1);
        expect(g.lives).toBe(START_LIVES - 1);
    });

    it('투척병 수류탄을 보고 달아나면 맞지 않는다', () => {
        const g = withEnemy(ENEMY_THROWER, 14);
        let thrown = false;
        for (let t = 0; t < 400 && !thrown; t++) {
            thrown = step(g, 0).some((v) => v.type === 'enemy-throw');
        }
        expect(thrown).toBe(true);
        // 던진 순간부터 오른쪽(수류탄 아래를 지나)으로 달린다 — 떨어지는 자리는 원래 자리 근처
        const ev = run(g, BTN_RIGHT, 80);
        expect(count(ev, 'boom')).toBeGreaterThanOrEqual(1);
        expect(g.lives).toBe(START_LIVES);
    });

    it('투척병 수류탄은 같은 seed 면 같은 포물선이다 (가로 등속, 세로는 틱마다 중력만큼 빨라진다)', () => {
        function path(seed: number): [number, number][] {
            const g = createGame(
                seed,
                flat({ enemies: [{ kind: ENEMY_THROWER, col: 14, row: 11 }] })
            );
            const pts: [number, number][] = [];
            for (let t = 0; t < 600; t++) {
                g.player.invuln = 1_000_000;
                step(g, 0);
                const gr = g.grenades.find((v) => v.owner === OWNER_ENEMY);
                if (gr) pts.push([gr.x, gr.y]);
                else if (pts.length > 0) break;
            }
            return pts;
        }
        const a = path(5);
        expect(a.length).toBeGreaterThan(20);
        expect(path(5)).toEqual(a);
        for (let k = 2; k < a.length; k++) {
            expect(a[k][0] - a[k - 1][0]).toBe(a[1][0] - a[0][0]);
            expect(a[k][1] - a[k - 1][1] - (a[k - 1][1] - a[k - 2][1])).toBe(GRAVITY);
            expect(Number.isSafeInteger(a[k][0]) && Number.isSafeInteger(a[k][1])).toBe(true);
        }
        // 겨냥 오차는 ±LOB_SPREAD px 안 — 여러 seed 에서 떨어지는 자리가 대원 근처
        for (let seed = 1; seed <= 12; seed++) {
            const pts = path(seed);
            const g = createGame(seed, flat());
            const px = centerX(g.player);
            const last = pts[pts.length - 1][0];
            expect(Math.abs(last - px)).toBeLessThanOrEqual((LOB_SPREAD + 12) * S);
        }
    });

    it('투척병은 세 발에 쓰러져 150점, 적 수류탄은 적·상자를 다치게 하지 않는다', () => {
        const g = withEnemy(ENEMY_THROWER, 14);
        const ev = runInvuln(g, BTN_FIRE, 400);
        expect(count(ev, 'kill')).toBe(1);
        expect(count(ev, 'hit')).toBe(2);
        expect(g.score).toBe(enemySpec(ENEMY_THROWER).points);

        const h = createGame(
            1,
            flat({
                crates: [[20, 11]],
                enemies: [{ kind: ENEMY_DUMMY, col: 18, row: 11 }]
            })
        );
        runInvuln(h, 0, 1);
        const d = h.enemies[0];
        const x = d.x + (d.w >> 1);
        h.grenades.push({
            owner: OWNER_ENEMY,
            x,
            y: GROUND_Y - 4 * S,
            prevX: x,
            prevY: GROUND_Y - 4 * S,
            vx: 0,
            vy: 0,
            fuse: 1
        });
        const ev2 = runInvuln(h, 0, 2);
        expect(count(ev2, 'boom')).toBe(1);
        expect(d.hp).toBe(enemySpec(ENEMY_DUMMY).hp);
        expect(tileAt(h.map, 20, 11)).toBe(3);
        expect(h.score).toBe(0);
    });
});

type BoomEvent = Extract<StepEvent, { type: 'boom' }>;

describe('보스', () => {
    /** 처음부터 보스 구역인 평지 (구역 = 0~23열, 대원은 3열) */
    function bossStage(over: Partial<StageDef> = {}): StageDef {
        return flat({ boss: { lock: 0, hp: 90 }, ...over });
    }

    /** 보스가 들어와 제자리에서 쉬기 시작할 때까지 (무적) */
    function untilIdle(g: Game): void {
        for (let t = 0; t < 400 && g.boss?.mode !== BOSS_IDLE; t++) {
            g.player.invuln = 1_000_000;
            step(g, 0);
        }
        expect(g.boss?.mode).toBe(BOSS_IDLE);
        g.player.invuln = 0;
    }

    /**
     * 이번 공격이 끝날 때까지 mask 를 누른다 — 다시 쉬기 시작하면 다음 공격을 미뤄 두고
     * 적 총알·수류탄이 다 사라질 때까지 기다린다.
     */
    function untilRest(g: Game, mask: number, max = 600): StepEvent[] {
        const all: StepEvent[] = [];
        for (let t = 0; t < max && !g.over; t++) {
            all.push(...step(g, mask));
            const b = g.boss!;
            if (b.mode !== BOSS_IDLE) continue;
            b.modeT = 1_000_000;
            const flying =
                g.bullets.some((q) => q.owner === OWNER_ENEMY) || countGrenades(g, OWNER_ENEMY) > 0;
            if (!flying) break;
        }
        return all;
    }

    it('보스 구역에 오면 카메라가 멈추고 보스가 오른쪽 밖에서 제자리로 들어온다 (대원은 화면 밖으로 못 나간다)', () => {
        const g = createGame(1, bossStage());
        const ev = runInvuln(g, 0, 1);
        expect(count(ev, 'boss')).toBe(1);
        expect(g.locked).toBe(true);
        const b = g.boss!;
        expect(b.mode).toBe(BOSS_ENTER);
        expect(b.x).toBeGreaterThan(g.camX + (VIEW_W - BOSS_W) * S);
        expect(b.hp).toBe(90);
        expect(b.maxHp).toBe(90);
        // 몸통 발은 땅 위
        const [, by, , bh] = bossBox(b);
        expect(by + bh).toBe(GROUND_Y);
        expect(b.y + BOSS_H * S).toBe(GROUND_Y);
        for (let t = 0; t < 500; t++) {
            runInvuln(g, BTN_RIGHT, 1);
            expect(g.camX).toBe(0);
            expect(g.player.x + g.player.w).toBeLessThanOrEqual(g.camX + VIEW_W * S);
            // 보스 몸을 뚫고 지나가지 않는다 (돌진이 아닐 때 닿으면 밀려난다)
            const [bx] = bossBox(g.boss!);
            if (g.boss!.mode !== BOSS_ACT) expect(g.player.x + g.player.w).toBeLessThanOrEqual(bx);
        }
        expect(g.boss!.mode).not.toBe(BOSS_ENTER);
        expect(count(runInvuln(g, 0, 1), 'boss')).toBe(0);
    });

    it('공격 3가지 모두 멈춰 예고한 뒤에 하고, 같은 공격을 잇달아 하지 않는다', () => {
        for (const seed of [1, 2, 3]) {
            const g = createGame(seed, bossStage());
            const patterns: number[] = [];
            let windupAt = -1;
            let gaps: number[] = [];
            let pending = false;
            for (let t = 0; t < 4000 && patterns.length < 8; t++) {
                g.player.invuln = 1_000_000;
                const ev = step(g, BTN_DOWN);
                for (const v of ev) {
                    if (v.type === 'boss-windup') {
                        patterns.push(v.pattern);
                        windupAt = t;
                        pending = true;
                    } else if (
                        pending &&
                        (v.type === 'boss-shot' ||
                            v.type === 'boss-lob' ||
                            v.type === 'boss-charge')
                    ) {
                        gaps.push(t - windupAt);
                        pending = false;
                    }
                }
                // 예고 동안 돌진 말고는 제자리, 돌진 예고는 뒤로만 물러선다
                const b = g.boss!;
                if (b.mode === BOSS_WINDUP_MODE) expect(b.x).toBeGreaterThanOrEqual(b.prevX);
            }
            expect(new Set(patterns).size).toBe(3);
            for (let k = 1; k < patterns.length; k++) expect(patterns[k]).not.toBe(patterns[k - 1]);
            expect(gaps.length).toBeGreaterThanOrEqual(7);
            for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(30);
            gaps = [];
        }
    });

    it('앞 총: 엎드리면 머리 위로 지나가고 서 있으면 맞는다 (총알 높이 = 보병과 같다)', () => {
        const low = createGame(1, bossStage());
        untilIdle(low);
        startBossPattern(low, PATTERN_GUN, []);
        const ev = untilRest(low, BTN_DOWN);
        expect(count(ev, 'boss-shot')).toBe(BOSS_GUN_SHOTS);
        expect(low.lives).toBe(START_LIVES);

        const high = createGame(1, bossStage());
        untilIdle(high);
        startBossPattern(high, PATTERN_GUN, []);
        let shotY = -1;
        for (let t = 0; t < 400 && high.lives === START_LIVES; t++) {
            if (step(high, 0).some((v) => v.type === 'boss-shot')) {
                shotY = high.bullets.find((b) => b.owner === OWNER_ENEMY)!.y;
            }
        }
        expect(shotY).toBe(GROUND_Y - ENEMY_SHOT_Y * S);
        expect(high.lives).toBe(START_LIVES - 1);
    });

    it('박격포: 예고 때 보인 자리에 정확히 떨어진다 — 그 자리에 서 있으면 맞고 비키면 안 맞는다', () => {
        const still = createGame(1, bossStage());
        untilIdle(still);
        startBossPattern(still, PATTERN_MORTAR, []);
        const marks = still.boss!.marks.slice();
        expect(marks.length).toBe(6);
        // 첫 자리는 대원 발밑 (가운데 ±1px)
        expect(Math.abs(marks[0] - centerX(still.player))).toBeLessThanOrEqual(S);
        expect(marks[1]).toBe(GROUND_Y - S);
        const ev = untilRest(still, 0);
        const booms = ev.filter((v): v is BoomEvent => v.type === 'boom');
        expect(booms.length).toBe(3);
        const landed = booms.map((v) => `${v.x},${v.y}`).sort();
        const shown = [0, 2, 4].map((k) => `${marks[k]},${marks[k + 1]}`).sort();
        expect(landed).toEqual(shown);
        expect(still.lives).toBe(START_LIVES - 1);

        const moved = createGame(1, bossStage());
        untilIdle(moved);
        startBossPattern(moved, PATTERN_MORTAR, []);
        // 표시를 보고 오른쪽으로 비켜 선다 (가운데 자리와 오른쪽 자리 사이)
        run(moved, BTN_RIGHT, 30);
        untilRest(moved, 0);
        expect(moved.lives).toBe(START_LIVES);
    });

    it('박격포 자리는 발판 위 대원이면 발판 위다 (궤적을 미리 돌려 본 자리)', () => {
        const g = createGame(1, bossStage({ platforms: [[8, 9, 4]] }));
        untilIdle(g);
        const p = g.player;
        p.x = 9 * TILE_U + 2 * S;
        p.y = 9 * TILE_U - p.h;
        p.prevX = p.x;
        p.prevY = p.y;
        runInvuln(g, 0, 2);
        expect(feetY(p)).toBe(9 * TILE_U);
        g.player.invuln = 0;
        startBossPattern(g, PATTERN_MORTAR, []);
        expect(Math.abs(g.boss!.marks[0] - centerX(p))).toBeLessThanOrEqual(S);
        expect(g.boss!.marks[1]).toBe(9 * TILE_U - S);
        const ev = untilRest(g, 0);
        const first = ev.find((v): v is BoomEvent => v.type === 'boom');
        expect(first).toBeDefined();
        expect(g.lives).toBe(START_LIVES - 1);
    });

    it('돌진: 돌진선에서 멈춘다 — 선 왼쪽·낮은 발판 위는 안전하고, 길목에 서 있으면 맞는다', () => {
        const safe = createGame(1, bossStage());
        untilIdle(safe);
        startBossPattern(safe, PATTERN_CHARGE, []);
        let minX = Infinity;
        for (let t = 0; t < 400; t++) {
            step(safe, 0);
            minX = Math.min(minX, safe.boss!.x);
        }
        expect(minX).toBe(bossChargeStop(safe));
        expect(safe.lives).toBe(START_LIVES);
        // 돌아와 다시 제자리
        expect(safe.boss!.x).toBe(safe.boss!.homeX);

        const inPath = createGame(1, bossStage());
        untilIdle(inPath);
        teleport(inPath, 12);
        startBossPattern(inPath, PATTERN_CHARGE, []);
        const ev = run(inPath, 0, 300);
        expect(count(ev, 'die')).toBe(1);
        expect(inPath.lives).toBe(START_LIVES - 1);

        const up = createGame(1, bossStage({ platforms: [[10, 9, 4]] }));
        untilIdle(up);
        const p = up.player;
        p.x = 11 * TILE_U + 2 * S;
        p.y = 9 * TILE_U - p.h;
        p.prevX = p.x;
        p.prevY = p.y;
        // 발판(땅에서 48px)은 보스 맞는 상자(36px)보다 높다
        expect(3 * TILE).toBeGreaterThan(BOSS_HIT_H);
        startBossPattern(up, PATTERN_CHARGE, []);
        let under = false;
        for (let t = 0; t < 400; t++) {
            step(up, 0);
            const [bx, , bw] = bossBox(up.boss!);
            if (bx < p.x + p.w && bx + bw > p.x) under = true;
        }
        expect(under).toBe(true);
        expect(feetY(p)).toBe(9 * TILE_U);
        expect(up.lives).toBe(START_LIVES);
    });

    it('돌진이 아닐 때 몸에 닿으면 다치지 않고 밀려난다', () => {
        const g = createGame(1, bossStage());
        untilIdle(g);
        const [bx] = bossBox(g.boss!);
        g.player.x = bx + 4 * S;
        g.player.prevX = g.player.x;
        step(g, 0);
        expect(g.player.x + g.player.w).toBeLessThanOrEqual(bossBox(g.boss!)[0]);
        expect(g.lives).toBe(START_LIVES);
    });

    it('권총 1 · 수류탄 BLAST_DAMAGE 씩 깎이고, 쓰러지면 점수·적 탄 정리 뒤 구간 끝 (남은 시간·목숨 보너스)', () => {
        const nade = createGame(1, bossStage());
        untilIdle(nade);
        const b0 = nade.boss!;
        const [bx, by, bw, bh] = bossBox(b0);
        const cx = bx + (bw >> 1);
        const cy = by + (bh >> 1);
        nade.grenades.push({
            owner: OWNER_PLAYER,
            x: cx,
            y: cy,
            prevX: cx,
            prevY: cy,
            vx: 0,
            vy: 0,
            fuse: 5
        });
        runInvuln(nade, 0, 1);
        expect(b0.hp).toBe(b0.maxHp - BLAST_DAMAGE);

        const g = createGame(1, bossStage());
        let firstHit = -1;
        let downAt = -1;
        let clearEv: StepEvent | undefined;
        for (let t = 0; t < 8000 && !g.over; t++) {
            g.player.invuln = 1_000_000;
            const hpBefore = g.boss?.hp ?? -1;
            const ev = step(g, t % 2 === 0 ? BTN_FIRE : 0);
            if (firstHit < 0 && ev.some((v) => v.type === 'boss-hit')) {
                firstHit = t;
                expect(g.boss!.hp).toBe(hpBefore - 1);
            }
            if (ev.some((v) => v.type === 'boss-down')) {
                downAt = t;
                expect(g.boss!.hp).toBe(0);
                expect(g.score).toBeGreaterThanOrEqual(BOSS_POINTS);
            }
            if (downAt >= 0) {
                // 쓰러진 뒤엔 적 총알·수류탄이 없다
                expect(g.bullets.every((b) => b.owner === OWNER_PLAYER)).toBe(true);
                expect(countGrenades(g, OWNER_ENEMY)).toBe(0);
                expect(bossHittable(g)).toBe(false);
            }
            clearEv = ev.find((v) => v.type === 'clear') ?? clearEv;
        }
        expect(firstHit).toBeGreaterThan(0);
        expect(downAt).toBeGreaterThan(firstHit);
        expect(g.over).toBe(true);
        expect(g.reason).toBe('clear');
        expect(g.boss!.mode).toBe(BOSS_DOWN);
        expect(g.tally.boss).toBe(BOSS_POINTS);
        expect(g.tally.lives).toBe(START_LIVES * LIFE_BONUS);
        // 남은 시간(초) × TIME_POINTS — 끝난 틱 기준이라 판이 끝난 뒤 다시 재면 1초 안쪽으로 다를 수 있다
        expect(Math.abs(g.tally.time - timeLeft(g) * TIME_POINTS)).toBeLessThanOrEqual(TIME_POINTS);
        expect(g.tally.time).toBeGreaterThan(0);
        expect(clearEv).toEqual({
            type: 'clear',
            bonus: g.tally.time + g.tally.lives,
            time: g.tally.time,
            lives: g.tally.lives
        });
        const t = g.tally;
        expect(t.enemies + t.crates + t.boss + t.time + t.lives).toBe(g.score);
    });

    it('목숨이 다하면 보스 앞에서도 판이 끝난다 (보너스 없음)', () => {
        const g = createGame(1, bossStage());
        untilIdle(g);
        for (let k = 0; k < START_LIVES && !g.over; k++) {
            g.player.invuln = 0;
            spawnBullet(g, OWNER_ENEMY, centerX(g.player), g.player.y + (g.player.h >> 1), 0, 0);
            run(g, 0, 1 + DEATH_TICKS);
        }
        expect(g.reason).toBe('lives');
        expect(g.tally.time + g.tally.lives).toBe(0);
    });

    it('같은 seed + 같은 입력이면 보스전도 똑같다 (상태는 정수만)', () => {
        const a = playRandom(31, 5, 5000, bossStage());
        const b = playRandom(31, 5, 5000, bossStage());
        expect(a.boss).not.toBeNull();
        expect(a.boss!.pattern).toBeGreaterThanOrEqual(0);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        const bad: string[] = [];
        const walk = (v: unknown, path: string) => {
            if (typeof v === 'number') {
                if (!Number.isSafeInteger(v)) bad.push(`${path}=${v}`);
            } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
            else if (v && typeof v === 'object') {
                for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
            }
        };
        walk(a, 'g');
        expect(bad).toEqual([]);
        // 보스 공격 차례는 seed 로 정해진다
        const order = (seed: number) => {
            const g = createGame(seed, bossStage());
            const seen: number[] = [];
            for (let t = 0; t < 3000 && seen.length < 6; t++) {
                g.player.invuln = 1_000_000;
                for (const v of step(g, BTN_DOWN))
                    if (v.type === 'boss-windup') seen.push(v.pattern);
            }
            return seen.join(',');
        };
        expect(order(8)).toBe(order(8));
        const orders = new Set([1, 2, 3, 4, 5, 6].map(order));
        expect(orders.size).toBeGreaterThan(1);
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

    it('잠금 구간에서는 그 화면의 적을 다 잡아야 카메라가 다시 간다 (적도 화면 밖으로 나가지 않는다)', () => {
        const g = createGame(1);
        const lock = STAGE_1.locks[0];
        const lockAt = lock * TILE_U;
        // 상자를 넘어 첫 잠금 구간 안으로 옮겨 놓는다
        teleport(g, lock + 8);
        const ev = runInvuln(g, BTN_RIGHT, 30);
        expect(count(ev, 'lock')).toBe(1);
        expect(g.locked).toBe(true);
        expect(g.camX).toBe(lockAt);
        // 화면 오른쪽 끝 밖으로도 못 간다
        expect(g.player.x + g.player.w).toBeLessThanOrEqual(g.camX + VIEW_W * S);
        expect(g.enemies.length).toBeGreaterThan(0);
        // 오래 기다려도 적은 화면 안에 머문다 (잠금이 풀리지 않는다)
        runInvuln(g, 0, 600);
        expect(g.locked).toBe(true);
        expect(g.enemies.length).toBeGreaterThan(0);
        for (const e of g.enemies) {
            expect(e.x).toBeGreaterThanOrEqual(g.camX);
            expect(e.x + e.w).toBeLessThanOrEqual(g.camX + VIEW_W * S);
        }
        for (const e of g.enemies) e.hp = 0;
        const ev2 = runInvuln(g, BTN_RIGHT, 2);
        expect(count(ev2, 'unlock')).toBe(1);
        expect(g.locked).toBe(false);
        runInvuln(g, BTN_RIGHT, 90);
        expect(g.camX).toBeGreaterThan(lockAt);
    });
});

const DIRS = BTN_LEFT | BTN_RIGHT;

function dirBtn(d: number): number {
    return d > 0 ? BTN_RIGHT : BTN_LEFT;
}

/** 대원 앞(dir 쪽) within px 안에서 구덩이(아래에 땅이 전혀 없는 열)가 시작되는 거리(px), 없으면 −1 */
function pitAhead(g: Game, dir: number, within: number): number {
    const p = g.player;
    const edge = dir > 0 ? p.x + p.w : p.x - 1;
    for (let d = 0; d <= within; d += 2) {
        const col = fdiv(edge + dir * d * S, TILE_U);
        if (col < 0 || col >= g.map.cols) return -1;
        let ground = false;
        for (let r = 0; r < g.map.rows && !ground; r++) ground = tileAt(g.map, col, r) === T_SOLID;
        if (!ground) return d;
    }
    return -1;
}

/** 화면 안에서 가장 가까운 적 */
function nearestOnScreen(g: Game): Enemy | null {
    const cx = centerX(g.player);
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of g.enemies) {
        if (e.hp <= 0 || e.x + e.w <= g.camX || e.x >= g.camX + VIEW_W * S) continue;
        const d = Math.abs(e.x + (e.w >> 1) - cx);
        if (d < bestD) {
            bestD = d;
            best = e;
        }
    }
    return best;
}

describe('1단계 구간', () => {
    const st = STAGE_1;
    const { map } = buildMap(st);
    const screen = VIEW_W / TILE;

    /** 열의 땅(ground 정의) 맨 위 줄 — 구덩이면 −1 */
    function groundTop(col: number): number {
        for (const [c0, c1, top] of st.ground) if (col >= c0 && col <= c1) return top;
        return -1;
    }

    it('적은 모두 땅이나 발판 위에 서 있고 몸이 들어갈 두 칸이 비어 있다. 출발 자리도 비어 있다', () => {
        expect(STAGES[0]).toBe(st);
        for (const e of st.enemies) {
            expect(isSolid(tileAt(map, e.col, e.row))).toBe(false);
            expect(isSolid(tileAt(map, e.col, e.row - 1))).toBe(false);
            const below = tileAt(map, e.col, e.row + 1);
            expect(below === T_SOLID || below === T_PLATFORM).toBe(true);
        }
        const [c, r] = st.start;
        expect(tileAt(map, c, r)).toBe(T_EMPTY);
        expect(tileAt(map, c, r + 1)).toBe(T_SOLID);
    });

    it('잠금 구간마다 그 화면 안에 적이 셋 이상 있고, 잠금은 차례대로 지도 안·깃발 앞에 있다', () => {
        let prev = -1;
        for (const lock of st.locks) {
            expect(lock).toBeGreaterThan(prev);
            prev = lock;
            expect(lock + screen).toBeLessThanOrEqual(st.cols);
            const inside = st.enemies.filter((e) => e.col >= lock && e.col < lock + screen);
            expect(inside.length).toBeGreaterThanOrEqual(3);
        }
        expect(st.goal).toBeGreaterThan(prev);
        expect(st.goal).toBeLessThan(st.cols);
    });

    it('높이 차이는 점프로 넘는다 — 턱·바위 2칸 이하, 구덩이 2칸 폭 이하, 잠금 화면엔 구덩이 없음', () => {
        const segs = [...st.ground].sort((a, b) => a[0] - b[0]);
        expect(segs[0][0]).toBe(0);
        expect(segs[segs.length - 1][1]).toBe(st.cols - 1);
        for (let k = 1; k < segs.length; k++) {
            const gap = segs[k][0] - segs[k - 1][1] - 1;
            expect(gap).toBeGreaterThanOrEqual(0);
            expect(gap).toBeLessThanOrEqual(2);
            if (gap === 0) {
                expect(Math.abs(segs[k][2] - segs[k - 1][2])).toBeLessThanOrEqual(2);
            }
        }
        for (const [c, r, w, h] of st.blocks) {
            expect(h).toBeLessThanOrEqual(2);
            for (let x = c; x < c + w; x++) expect(groundTop(x)).toBe(r + h);
        }
        for (const [c, r] of st.crates) expect(isSolid(tileAt(map, c, r + 1))).toBe(true);
        for (const lock of st.locks) {
            for (let col = lock; col < lock + screen; col++) {
                expect(groundTop(col)).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('분량 — 화면 13개 남짓, 적 40명 이상(보병·투척병)', () => {
        expect(st.cols).toBeGreaterThanOrEqual(13 * screen);
        expect(st.enemies.length).toBeGreaterThanOrEqual(40);
        expect(st.enemies.some((e) => e.kind === ENEMY_RIFLE)).toBe(true);
        expect(st.enemies.some((e) => e.kind === ENEMY_THROWER)).toBe(true);
        expect(st.enemies.every((e) => e.kind !== ENEMY_DUMMY)).toBe(true);
    });

    it('보스 구역은 마지막 화면 — 평지, 적·상자·바위 없음, 돌진을 피할 낮은 발판(뛰면 닿고 보스 몸통보다 높다)', () => {
        const boss = st.boss!;
        expect(boss).toBeDefined();
        expect(boss.hp).toBeGreaterThan(0);
        expect(boss.lock).toBeGreaterThan(st.locks[st.locks.length - 1]);
        expect(boss.lock + screen).toBe(st.cols);
        // 깃발 대신 보스 — goal 은 보스 구역 들머리(진행률 기준)
        expect(st.goal).toBe(boss.lock);
        for (let col = boss.lock; col < st.cols; col++) expect(groundTop(col)).toBe(GROUND_ROW);
        expect(st.enemies.every((e) => e.col < boss.lock)).toBe(true);
        expect(st.crates.every(([c]) => c < boss.lock)).toBe(true);
        expect(st.blocks.every(([c, , w]) => c + w <= boss.lock)).toBe(true);
        const pads = st.platforms.filter(([c]) => c >= boss.lock);
        expect(pads.length).toBeGreaterThanOrEqual(1);
        for (const [c, r, len] of pads) {
            expect(c + len).toBeLessThanOrEqual(st.cols);
            expect(GROUND_ROW - r).toBe(3);
            expect((GROUND_ROW - r) * TILE).toBeGreaterThan(BOSS_HIT_H);
            // 돌진이 지나가는 자리(돌진선 오른쪽)에 걸쳐 있다
            expect((c + len - boss.lock) * TILE).toBeGreaterThan(124);
        }
        const g = createGame(1);
        expect(bossLockX(g)).toBe(boss.lock * TILE_U);
        // 카메라 끝 = 보스 구역
        expect((st.cols * TILE - VIEW_W) / TILE).toBe(boss.lock);
    });

    /**
     * 무적 봇: 가장 가까운 적에게 다가가 쏜다. 적이 머리 위(발판)에 있으면 그 아래에서 위로 쏜다.
     * 적이 발 아래에 있으면 발판에서 내려간다. 막히거나 구덩이 앞이면 뛴다. 적이 없으면 오른쪽으로.
     * 보스가 있으면 보스 쪽을 보고 쏜다(뛰지 않는다 — 뛰어넘어 뒤로 가지 않게).
     */
    function botMask(g: Game, stuck: boolean): number {
        const p = g.player;
        if (p.dead > 0) return 0;
        const cx = centerX(p);
        if (bossHittable(g)) {
            const [bx, , bw] = bossBox(g.boss!);
            const dx = bx + (bw >> 1) - cx;
            const dir = dx < 0 ? -1 : 1;
            return BTN_FIRE | (dir !== p.facing || Math.abs(dx) > 120 * S ? dirBtn(dir) : 0);
        }
        const target = nearestOnScreen(g);
        let m = BTN_FIRE;
        if (!target) m |= BTN_RIGHT;
        else {
            const ecx = target.x + (target.w >> 1);
            const above = target.y + target.h < p.y - 8 * S;
            const below = target.y + target.h > feetY(p) + 16 * S;
            if (above) {
                const inRight = cx >= ecx - 11 * S && cx <= ecx - 3 * S;
                const inLeft = cx >= ecx + 3 * S && cx <= ecx + 11 * S;
                if ((p.facing === 1 && inRight) || (p.facing === -1 && inLeft)) m |= BTN_UP;
                else if (cx < ecx - 11 * S) m |= BTN_RIGHT;
                else if (cx > ecx + 11 * S) m |= BTN_LEFT;
                else if (cx < ecx) m |= cx > ecx - 3 * S ? BTN_LEFT : BTN_RIGHT;
                else m |= cx < ecx + 3 * S ? BTN_RIGHT : BTN_LEFT;
            } else if (below && onPlatformOnly(g.map, p)) {
                m = p.crouch ? BTN_DOWN | BTN_JUMP : BTN_DOWN;
            } else {
                const dx = ecx - cx;
                if (below || Math.abs(dx) > 40 * S || Math.sign(dx) !== p.facing) {
                    m |= dx > 0 ? BTN_RIGHT : BTN_LEFT;
                }
            }
        }
        const dir = m & BTN_RIGHT ? 1 : m & BTN_LEFT ? -1 : 0;
        if (dir !== 0 && p.onGround && (stuck || pitAhead(g, dir, 12) >= 0)) m |= BTN_JUMP;
        return m;
    }

    it('무적 봇이 1단계 끝까지 가며 거의 모든 적을 잡고 보스를 쓰러뜨린다', () => {
        const g = createGame(2024);
        let bossAt = -1;
        let jumpHold = 0;
        let lastX = g.player.x;
        let stuckTicks = 0;
        let airDir = 0;
        for (let t = 0; t < MAX_TICKS && !g.over; t++) {
            g.player.invuln = 1_000_000;
            const p = g.player;
            stuckTicks = p.onGround && p.x === lastX ? stuckTicks + 1 : 0;
            lastX = p.x;
            let m = botMask(g, stuckTicks > 2);
            // 공중에서는 뛰어오른 쪽 그대로 (구덩이 위에서 돌아서지 않는다)
            if (p.onGround) airDir = m & DIRS;
            else m = (m & ~DIRS) | airDir;
            if (jumpHold > 0) {
                m |= BTN_JUMP;
                jumpHold--;
            } else if ((m & BTN_JUMP) !== 0) {
                if ((g.prevMask & BTN_JUMP) !== 0) m &= ~BTN_JUMP;
                else jumpHold = 20;
            }
            if (step(g, m).some((v) => v.type === 'boss')) bossAt = t;
        }
        const t = g.tally;
        console.log(
            `[commando] invulnerable bot: reason=${g.reason} time=${Math.round(g.tick / TICK_HZ)}s bossAt=${Math.round(bossAt / TICK_HZ)}s bossFight=${Math.round((g.tick - bossAt) / TICK_HZ)}s kills=${g.kills}/${st.enemies.length} lives=${g.lives} score=${g.score} (enemies=${t.enemies} crates=${t.crates} boss=${t.boss} time=${t.time} lives=${t.lives})`
        );
        expect(g.reason).toBe('clear');
        expect(bossAt).toBeGreaterThan(0);
        expect(g.boss!.mode).toBe(BOSS_DOWN);
        expect(t.boss).toBe(BOSS_POINTS);
        expect(t.enemies + t.crates + t.boss + t.time + t.lives).toBe(g.score);
        expect(g.lives).toBeGreaterThanOrEqual(START_LIVES - 1);
        expect(g.kills).toBeGreaterThanOrEqual(st.enemies.length - 4);
    }, 60_000);
});

describe('난이도 (초보 봇)', () => {
    /** 판단 간격 0.25초 */
    const DECIDE_TICKS = TICK_HZ / 4;
    /** 위협에 반응할 확률(%) · 이번 판단에 못 쏘는 실수 확률(%) · 수류탄 던질 확률(%) */
    const REACT = 80;
    const MISS = 25;
    const LOB = 6;
    /** 적 수류탄 떨어질 자리 어림 오차(px) — 판단마다 −LAND_ERR ~ +LAND_ERR (사람 눈대중) */
    const LAND_ERR = 10;

    /** 적 수류탄이 대원 발 높이까지 떨어질 때의 x (단위, 대략) */
    function landingX(x: number, y: number, vx: number, vy: number, floor: number): number {
        for (let k = 0; k < 120 && y < floor; k++) {
            vy = Math.min(vy + GRAVITY, MAX_FALL);
            x += vx;
            y += vy;
        }
        return x;
    }

    /**
     * 초보 봇 한 번의 판단 (다음 0.25초 동안 누를 버튼).
     * - 공중이면 가던 쪽 그대로.
     * - (반응했을 때) 가까이 떨어질 적 수류탄 → 반대쪽으로 달린다. 머리 높이로 오는 적 총알 → 엎드려 쏜다.
     * - 아니면 화면 안 가장 가까운 적: 같은 높이면 그쪽을 보고 쏘며(멀면 다가감), 높은 곳이면 위로 쏘며 다가가고,
     *   낮은 곳이면 발판에서 내려간다. 적이 없으면 오른쪽으로 달리며 쏜다. 가끔 못 쏘고(조준 실수), 가끔 수류탄.
     * - 구덩이 앞이거나 막혀 있으면 뛴다.
     * - 적 수류탄 떨어질 자리는 눈대중이다(판단마다 ±LAND_ERR px 오차).
     * - 보스: (반응했을 때) 돌진 경고 → 돌진선 왼쪽으로, 총구 번쩍임 → 엎드려 쏨, 떨어질 자리 표시 → 표시에서 비킨다.
     *   아니면 보스 쪽을 보고 쏜다(멀면 다가감, 가끔 수류탄).
     * 한 번 피하기 시작하면(엎드림·달아남) 위협이 남아 있는 동안은 다시 주사위를 굴리지 않고 이어 간다
     * (사람도 엎드렸으면 총알이 지나갈 때까지 엎드려 있다).
     */
    let dodging = false;
    function decide(g: Game, rand: () => number, prev: number, stuck: boolean): number {
        const p = g.player;
        if (p.dead > 0) {
            dodging = false;
            return 0;
        }
        const react = rand() % 100 < REACT || dodging;
        const miss = rand() % 100 < MISS;
        const lob = rand() % 100 < LOB;
        const landErr = ((rand() % (2 * LAND_ERR + 1)) - LAND_ERR) * S;
        if (!p.onGround) return (prev & (DIRS | BTN_JUMP)) | BTN_FIRE;
        const cx = centerX(p);
        const feet = feetY(p);
        const boss = bossHittable(g) ? g.boss! : null;
        let m = 0;
        let threat = false;
        if (react) {
            for (const gr of g.grenades) {
                if (gr.owner !== OWNER_ENEMY) continue;
                const lx = landingX(gr.x, gr.y, gr.vx, gr.vy, feet) + landErr;
                if (Math.abs(lx - cx) >= 44 * S) continue;
                // 떨어질 자리에서 멀어지는 쪽 — 거의 제자리면 던진 쪽의 반대쪽으로
                let away = Math.abs(lx - cx) >= 12 * S ? (lx > cx ? -1 : 1) : gr.vx < 0 ? -1 : 1;
                // 벽·화면 끝에 막혔으면 반대쪽으로 달린다
                const wall =
                    boxHitsSolid(g.map, p.x + away * TILE_U, p.y, p.w, p.h) ||
                    boxHitsSolid(g.map, p.x + 2 * away * TILE_U, p.y, p.w, p.h);
                const edge =
                    (away < 0 && p.x < g.camX + 24 * S) ||
                    (away > 0 && g.locked && p.x + p.w > g.camX + (VIEW_W - 24) * S);
                if (wall || edge) away = -away;
                m = dirBtn(away);
                threat = true;
                break;
            }
        }
        if (react && !threat) {
            for (const b of g.bullets) {
                if (b.owner !== OWNER_ENEMY || b.vy !== 0) continue;
                // 다가오는 총알, 또는 아직 몸 위를 지나가고 있는 총알
                const coming = (b.vx < 0 && b.x > cx - 12 * S) || (b.vx > 0 && b.x < cx + 12 * S);
                if (!coming || Math.abs(b.x - cx) > 110 * S) continue;
                if (b.y < feet - 24 * S || b.y > feet - 12 * S) continue;
                const from = b.vx < 0 ? 1 : -1;
                m = BTN_DOWN | (miss ? 0 : BTN_FIRE) | (from !== p.facing ? dirBtn(from) : 0);
                threat = true;
                break;
            }
        }
        if (react && !threat) {
            // 같은 높이에서 이쪽을 보고 겨누는(예고 자세) 보병 → 미리 엎드린다
            for (const e of g.enemies) {
                if (e.mode !== MODE_WINDUP || enemySpec(e.kind).attack !== ATTACK_SHOT) continue;
                const ex = e.x + (e.w >> 1);
                if (Math.abs(e.y + e.h - feet) > 8 * S || Math.abs(ex - cx) > 200 * S) continue;
                if ((ex < cx ? 1 : -1) !== e.facing) continue;
                m =
                    BTN_DOWN |
                    (miss ? 0 : BTN_FIRE) |
                    (e.facing === p.facing ? dirBtn(-e.facing) : 0);
                threat = true;
                break;
            }
        }
        if (react && !threat) {
            // 팔을 든(예고) 투척병 → 서 있지 말고 반대쪽으로 달린다(지금 자리를 겨누니까). 막혔으면 그쪽으로
            for (const e of g.enemies) {
                if (e.mode !== MODE_WINDUP || enemySpec(e.kind).attack !== ATTACK_LOB) continue;
                const ex = e.x + (e.w >> 1);
                if (Math.abs(ex - cx) > 180 * S) continue;
                let to = ex > cx ? -1 : 1;
                const blocked =
                    boxHitsSolid(g.map, p.x + 2 * to * TILE_U, p.y, p.w, p.h) ||
                    (to < 0 && p.x < g.camX + 32 * S) ||
                    (to > 0 && g.locked && p.x + p.w > g.camX + (VIEW_W - 32) * S);
                if (blocked) to = -to;
                m = dirBtn(to) | (miss ? 0 : BTN_FIRE);
                threat = true;
                break;
            }
        }
        if (react && !threat && boss) {
            // 보스 예고를 읽는다 (사람이 보는 것과 같은 신호: 경고등·총구 번쩍임·떨어질 자리 표시)
            const [bx, by, bw, bh] = bossBox(boss);
            const charging =
                boss.pattern === PATTERN_CHARGE &&
                (boss.mode === BOSS_WINDUP_MODE || boss.mode === BOSS_ACT);
            if (charging) {
                // 돌진선 왼쪽으로 물러난다
                const line = bossChargeStop(g) + 4 * S;
                m = p.x + p.w > line - 8 * S ? BTN_LEFT : 0;
                threat = true;
            } else if (
                boss.mode === BOSS_WINDUP_MODE &&
                boss.pattern === PATTERN_GUN &&
                Math.abs(by + bh - feet) <= 8 * S
            ) {
                const toward = bx + (bw >> 1) > cx ? 1 : -1;
                m = BTN_DOWN | (miss ? 0 : BTN_FIRE) | (toward !== p.facing ? dirBtn(toward) : 0);
                threat = true;
            } else if (boss.pattern === PATTERN_MORTAR) {
                for (let k = 0; k < boss.marks.length; k += 2) {
                    const d = cx - boss.marks[k];
                    if (Math.abs(d) >= 30 * S) continue;
                    let away = d > 0 ? 1 : -1;
                    if (away > 0 && p.x + p.w + 24 * S > bx) away = -1;
                    if (away < 0 && p.x < g.camX + 16 * S) away = 1;
                    m = dirBtn(away) | (miss ? 0 : BTN_FIRE);
                    threat = true;
                    break;
                }
            }
        }
        if (!threat && boss) {
            // 보스 쪽을 보고 쏜다 — 멀면 다가간다
            const [bx, , bw] = bossBox(boss);
            const dx = bx + (bw >> 1) - cx;
            const dir = dx < 0 ? -1 : 1;
            m = BTN_FIRE | (Math.abs(dx) > 120 * S || dir !== p.facing ? dirBtn(dir) : 0);
            if (miss) m &= ~BTN_FIRE;
            if (lob && p.grenades > 0 && Math.abs(dx) < 140 * S) m |= BTN_GRENADE;
        } else if (!threat) {
            const target = nearestOnScreen(g);
            if (!target) {
                m = BTN_RIGHT | BTN_FIRE;
            } else {
                const ecx = target.x + (target.w >> 1);
                const dx = ecx - cx;
                const dir = dx < 0 ? -1 : 1;
                const tFeet = target.y + target.h;
                if (tFeet < feet - 24 * S) {
                    // 높은 곳: 위로 쏘며 밑으로 간다 (총구는 몸 앞 7px)
                    const off = ecx - (cx + p.facing * 7 * S);
                    m = BTN_UP | BTN_FIRE;
                    if (Math.abs(off) > 8 * S) m |= dirBtn(off < 0 ? -1 : 1);
                } else if (tFeet > feet + 24 * S && onPlatformOnly(g.map, p)) {
                    m = p.crouch ? BTN_DOWN | BTN_JUMP : BTN_DOWN;
                } else if (Math.abs(dx) > 120 * S || dir !== p.facing || tFeet > feet + 24 * S) {
                    m = dirBtn(dir) | BTN_FIRE;
                } else {
                    m = BTN_FIRE;
                }
                if (miss) m &= ~BTN_FIRE;
                if (lob && p.grenades > 0 && Math.abs(dx) < 140 * S && tFeet >= feet - 24 * S) {
                    m |= BTN_GRENADE;
                }
            }
        }
        dodging = threat;
        const d = m & BTN_RIGHT ? 1 : m & BTN_LEFT ? -1 : 0;
        // 엎드려 피하는 중에는 뛰지 않는다 (일어서면 맞는다). 보스 앞에서는 막혀도 뛰지 않는다(보스에게 밀린 것)
        const jumpStuck = stuck && !boss;
        if (d !== 0 && (m & BTN_DOWN) === 0 && (jumpStuck || pitAhead(g, d, 30) >= 0))
            m |= BTN_JUMP;
        return m;
    }

    interface BotRun {
        /** 목숨을 잃은 자리(열)와 까닭: pit(구덩이)·blast(수류탄)·shot(총알)·ram(보스 돌진) */
        deaths: string[];
        reason: string;
        ticks: number;
        progress: number;
        kills: number;
        lives: number;
        score: number;
        /** 보스 구역에 닿았는가, 닿은 시각(초), 끝났을 때 보스 체력 */
        boss: boolean;
        bossAt: number;
        bossHp: number;
    }

    function beginnerRun(seed: number): BotRun {
        const g = createGame(seed);
        const rand = testRng(seed * 7919 + 13);
        let mask = 0;
        let lastX = g.player.x;
        let best = 0;
        let bossAt = -1;
        const deaths: string[] = [];
        dodging = false;
        for (let t = 0; t < MAX_TICKS && !g.over; t++) {
            const p = g.player;
            const decideNow = t % DECIDE_TICKS === 0;
            if (decideNow) {
                const stuck = p.dead === 0 && p.onGround && p.x === lastX && (mask & DIRS) !== 0;
                lastX = p.x;
                mask = decide(g, rand, mask, stuck);
            }
            let m = mask;
            // 점프는 누른 순간에만 먹는다 — 이어서 또 뛰려면 한 틱 뗐다가 누른다
            if (decideNow && p.onGround && (m & BTN_JUMP) !== 0 && (g.prevMask & BTN_JUMP) !== 0) {
                m &= ~BTN_JUMP;
            }
            // 진단용: 맞기 직전 자세(엎드림·땅·버튼)와 가까운 적 총알의 높이(발에서 px)
            const pose = `c${p.crouch ? 1 : 0}g${p.onGround ? 1 : 0}m${m}`;
            let near = '';
            for (const b of g.bullets) {
                if (b.owner === OWNER_ENEMY && Math.abs(b.x - centerX(p)) < 16 * S) {
                    near = `b${Math.round((feetY(p) - b.y) / S)}`;
                }
            }
            const bombs = g.grenades.filter((q) => q.owner === OWNER_ENEMY).map((q) => ({ ...q }));
            const ev = step(g, m);
            if (bossAt < 0 && g.boss) bossAt = t;
            if (ev.some((v) => v.type === 'die')) {
                const b = g.boss;
                const why =
                    g.player.y > g.map.rows * TILE_U
                        ? 'pit'
                        : ev.some((v) => v.type === 'boom')
                          ? 'blast'
                          : b && b.mode === BOSS_ACT && b.pattern === PATTERN_CHARGE
                            ? 'ram'
                            : 'shot';
                for (const v of ev) {
                    if (v.type !== 'boom') continue;
                    // 터진 자리: 대원 가운데에서 가로·발에서 높이(px), 남은 도화선(틱)
                    const gr = bombs.find((q) => Math.abs(q.x - v.x) < 8 * S);
                    near += `x${Math.round((v.x - centerX(g.player)) / S)}h${Math.round((feetY(g.player) - v.y) / S)}f${gr ? gr.fuse : -1}`;
                }
                deaths.push(`${fdiv(centerX(g.player), TILE_U)}:${why}/${pose}${near}`);
            }
            best = Math.max(best, centerX(g.player));
        }
        return {
            deaths,
            reason: g.reason,
            ticks: g.tick,
            progress: Math.min(100, Math.round((100 * best) / (g.stage.goal * TILE_U))),
            kills: g.kills,
            lives: g.lives,
            score: g.score,
            boss: bossAt >= 0,
            bossAt: bossAt >= 0 ? Math.round(bossAt / TICK_HZ) : -1,
            bossHp: g.boss ? g.boss.hp : -1
        };
    }

    /**
     * 기준 (계약: 첫 판에 보스까지 갈 수 있는 수준):
     * - 12판 중 3판 이상 보스 구역에 닿는다, 판의 절반 이상이 구간 절반을 넘는다(진행률 중앙값 50% 이상).
     * - 너무 쉽지 않게 — 보스 구역에 닿는 판은 10판 이하, 판마다 평균 목숨 1개 이상을 잃는다.
     * 보스를 깬 판 수는 기록만 한다 (보스를 깰 수 있다는 근거는 무적 봇·보스 단위 테스트).
     */
    it('초보 봇 12판 — 넷 중 하나 이상은 보스까지, 절반 이상은 구간 절반을 넘고, 너무 쉽지 않다', () => {
        const runs: BotRun[] = [];
        for (let seed = 1; seed <= 12; seed++) {
            const r = beginnerRun(seed);
            runs.push(r);
            console.log(
                `[commando] beginner seed=${seed} result=${r.reason} progress=${r.progress}% boss=${r.boss ? `${r.bossAt}s` : 'no'} bossHp=${r.bossHp} time=${Math.round(r.ticks / TICK_HZ)}s kills=${r.kills} lives=${r.lives} score=${r.score} deaths=${r.deaths.join(',')}`
            );
        }
        const reached = runs.filter((r) => r.boss);
        const clears = runs.filter((r) => r.reason === 'clear');
        const progress = runs.map((r) => r.progress).sort((a, b) => a - b);
        const median = progress[5];
        const lost = runs.reduce((n, r) => n + (START_LIVES - r.lives), 0) / runs.length;
        const bossTimes = reached.map((r) => r.bossAt).sort((a, b) => a - b);
        const clearTimes = clears.map((r) => Math.round(r.ticks / TICK_HZ)).sort((a, b) => a - b);
        const cols = runs
            .flatMap((r) => r.deaths.map((d) => Number(d.split(':')[0])))
            .sort((a, b) => a - b);
        console.log(
            `[commando] beginner summary reachBoss=${reached.length}/12 bossClears=${clears.length}/12 medianProgress=${median}% avgLivesLost=${lost.toFixed(2)} bossTimes=${bossTimes.join(',')}s clearTimes=${clearTimes.join(',')}s deathCols=${cols.join(',')}`
        );
        expect(reached.length).toBeGreaterThanOrEqual(3);
        expect(reached.length).toBeLessThanOrEqual(10);
        expect(median).toBeGreaterThanOrEqual(50);
        expect(lost).toBeGreaterThanOrEqual(1);
    }, 300_000);
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
        checkArt(ART.bomb, 6, 6);
        checkArt(ART.mark, 7, 5);
    });

    it('보스는 64×48 2프레임, 붉은 계열 — 앞 총 총구 줄은 총알 높이, 프레임마다 롤러가 돈다', () => {
        expect(BOSS.length).toBe(2);
        for (const frame of BOSS) {
            checkArt(frame, BOSS_W, BOSS_H);
            const all = frame.join('');
            expect(all).toMatch(/r/);
            expect(all).toMatch(/R/);
            // 아군 색(청록·파랑·노랑)은 쓰지 않는다
            expect(all).not.toMatch(/[gGby]/);
            // 총구(0열)는 발에서 ENEMY_SHOT_Y 위 줄, 그 줄은 쇠(m) 총열
            const gunRow = BOSS_H - ENEMY_SHOT_Y;
            expect(frame[gunRow].slice(1, 10)).toMatch(/^m+$/);
            // 맞는 상자 위(굴뚝·경고등) 말고 몸통은 맞는 상자 안에 있다
            for (let r = 0; r < BOSS_H - BOSS_HIT_H; r++) {
                expect(frame[r].slice(0, 30)).toMatch(/^\.+$/);
            }
        }
        expect(BOSS[0].join('')).not.toBe(BOSS[1].join(''));
    });

    it('보병·투척병은 윗몸 16줄 × 다리 8줄 = 24×24, 적 옷은 붉은 계열', () => {
        for (const top of [RIFLE_TOP, THROWER_TOP, THROWER_WINDUP]) {
            checkArt(top, CHAR_SIZE, 16);
            expect(top.join('')).toMatch(/[rR]/);
            for (const legs of [ENEMY_LEGS_STAND, ...ENEMY_LEGS_WALK]) {
                checkArt(legs, CHAR_SIZE, 8);
                checkArt(composeEnemy(top, legs), CHAR_SIZE, CHAR_SIZE);
            }
        }
        expect(ENEMY_LEGS_WALK.length).toBe(2);
        // 보병 총구 줄 = 총알 높이 (발에서 ENEMY_SHOT_Y 위), 총은 그림 오른쪽 끝까지
        const gunRow = CHAR_SIZE - ENEMY_SHOT_Y;
        expect(RIFLE_TOP[gunRow].slice(16, 23)).toMatch(/^m+$/);
    });

    it('보병 겨누기(예고) 그림 — 같은 총구 줄 끝이 번쩍인다 (서 있는 그림과 다르다)', () => {
        checkArt(RIFLE_AIM, CHAR_SIZE, 16);
        checkArt(composeEnemy(RIFLE_AIM, ENEMY_LEGS_STAND), CHAR_SIZE, CHAR_SIZE);
        expect(RIFLE_AIM.join('')).toMatch(/[rR]/);
        const gunRow = CHAR_SIZE - ENEMY_SHOT_Y;
        expect(RIFLE_AIM[gunRow].slice(16, 22)).toMatch(/^m+$/);
        // 총구 끝(23열)과 그 위아래에 번쩍임
        expect(RIFLE_AIM[gunRow][23]).toBe('w');
        expect(RIFLE_AIM[gunRow - 1][23]).toBe('y');
        expect(RIFLE_AIM[gunRow + 1][23]).toBe('y');
        expect(RIFLE_AIM.join('')).not.toBe(RIFLE_TOP.join(''));
    });

    it('공중에서 아래로 쏘기 그림 2프레임 — 총이 몸 가운데에서 아래를 향한다 (총알 방향과 같다)', () => {
        expect(AIR_DOWN.length).toBe(2);
        const g = createGame(1, flat());
        g.player.aimDown = true;
        const [mx, my, vx, vy] = muzzle(g.player);
        expect(vx).toBe(0);
        expect(vy).toBeGreaterThan(0);
        expect(mx).toBe(centerX(g.player));
        expect(my).toBeGreaterThan(feetY(g.player));
        for (const frame of AIR_DOWN) {
            checkArt(frame, CHAR_SIZE, CHAR_SIZE);
            // 가장 아래 쇠(m) 픽셀은 가운데 열(11~13) 다리 높이에 있다
            let low = -1;
            let col = -1;
            frame.forEach((row, r) => {
                const c = row.indexOf('m');
                if (c >= 0) {
                    low = r;
                    col = c;
                }
            });
            expect(low).toBeGreaterThanOrEqual(16);
            expect(col).toBeGreaterThanOrEqual(11);
            expect(col).toBeLessThanOrEqual(13);
        }
        expect(AIR_DOWN[0].join('')).not.toBe(AIR_DOWN[1].join(''));
    });
});

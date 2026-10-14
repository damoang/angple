/**
 * 다모앙 특공대 규칙 — 옆으로 달리며 쏘는 액션. DOM 없음, 결정적(deterministic).
 *
 * 같은 seed 와 같은 입력 기록을 넣으면 어느 기기에서 돌려도 같은 판·같은 점수가 나온다
 * (나중에 서버가 같은 규칙으로 끝난 판을 다시 돌려 점수를 확인할 수 있게 하려는 것).
 *
 * 결정성을 위한 약속
 * - 고정 틱 60회/초. 한 번의 step() = 한 틱. 시간(Date·performance)을 읽지 않는다.
 * - 좌표·속도는 모두 정수(고정소수점: 논리 1px = SCALE 단위). 나눗셈은 idiv·fdiv 뿐(physics.ts).
 * - 난수는 seed 에서 시작하는 mulberry32 하나뿐이고, 적이 쏘는 간격·수류탄 겨냥 오차에만 쓴다.
 *
 * 화면은 논리 384 × 216. 카메라는 오른쪽으로만 간다(되돌아가기 없음). 잠금 구간에서는 그때까지 나온
 * 적을 모두 잡아야 다시 움직인다.
 *
 * 동시 객체 상한: 적 20, 총알(내 것 + 적) 80, 날아가는 수류탄 내 것 4 · 적 것 6. 화면 밖으로 나간 것은 지운다.
 *
 * 적 (ENEMY_SPECS)
 * - 보병: 대원과 일정 거리를 두고 걷다가(낭떠러지·벽·화면 끝에서 돌아선다) 멈춰 겨눈 뒤 곧게 한 발 쏜다.
 *   총알은 발에서 ENEMY_SHOT_Y 위 — 엎드린 대원(키 14px)의 머리 위로 지나간다(엎드리면 피한다).
 *   대원 발이 같은 높이(LEVEL_TOLERANCE 안)일 때만 쏜다.
 * - 투척병: 멈춰 팔을 든 뒤 대원 쪽으로 수류탄을 포물선으로 던진다. 떨어진 자리에서 터지고 반경 안의 대원이 맞는다.
 * - 표적병: 제자리에서 이따금 쏜다(시험용).
 *
 * 입력 기록(InputLog) — 아직 어디에도 보내지 않는다(랭킹은 3단계).
 * - inputs: [틱, 버튼 묶음, …] 묶음이 바뀐 틱만. 처음 묶음은 0. 판 길이는 game.tick.
 *   replay(seed, log, ticks, stageId) 로 같은 판을 다시 만든다(어긋난 기록·없는 스테이지는 거부).
 *
 * 확장 자리 (다음 PR)
 * - 적: stages.ts 의 ENEMY_* 와 아래 ENEMY_SPECS(행동이 다르면 updateEnemy·enemyAttack).
 * - 무기: fire() 가 쏘는 총알 모양을 무기 종류로 나누면 된다(지금은 권총 하나, 무한).
 */
import {
    BTN_DOWN,
    BTN_FIRE,
    BTN_GRENADE,
    BTN_JUMP,
    BTN_LEFT,
    BTN_RIGHT,
    BTN_UP,
    createLogReader,
    normalizeMask,
    type InputLog
} from './input';
import {
    SCALE,
    TILE,
    TILE_U,
    T_CRATE,
    T_EMPTY,
    T_PLATFORM,
    T_SOLID,
    boxHitsSolid,
    boxesOverlap,
    fdiv,
    idiv,
    isSolid,
    moveX,
    moveY,
    mulberry32,
    onPlatformOnly,
    tileAt,
    type Body,
    type TileMap
} from './physics';
import { ENEMY_DUMMY, ENEMY_RIFLE, ENEMY_THROWER, STAGES, buildMap, type StageDef } from './stages';

export { SCALE, TILE, idiv, mulberry32 };

const S = SCALE;

/** 1초 틱 수 */
export const TICK_HZ = 60;
/** 화면(논리 px) */
export const VIEW_W = 384;
export const VIEW_H = 216;

/** 대원 맞는 상자(px): 서 있을 때·엎드렸을 때 */
export const PLAYER_W = 12;
export const PLAYER_H = 22;
export const CROUCH_H = 14;
/** 달리기·엎드려 기기 속도(단위/틱) — 1.5px · 0.75px */
export const RUN_SPEED = 384;
export const CROUCH_SPEED = 192;
/** 중력(단위/틱²) 0.25px, 최대 낙하 속도 6px(타일보다 작다 → 바닥 뚫림 없음) */
export const GRAVITY = 64;
export const MAX_FALL = 1536;
/** 점프 첫 속도 5.25px/틱(끝까지 누르면 약 52px), 일찍 떼면 위로 가는 속도를 2px/틱으로 자른다 */
export const JUMP_V = 1344;
export const JUMP_CUT = 512;
/** 엎드려 점프로 발판 아래로 내려갈 때 발판을 무시하는 틱 */
export const DROP_TICKS = 8;

/** 권총: 총알 속도 6px/틱, 누르고 있으면 FIRE_TICKS 마다 연사, 다시 누르면 조금 더 빨리 */
export const BULLET_SPEED = 1536;
export const FIRE_TICKS = 8;
export const TAP_FIRE_TICKS = 4;
/** 총알 반폭(px) — 지나온 길 전체를 이 굵기로 검사한다(터널링 없음) */
export const BULLET_HALF = 2;
/** 적 총알 속도 2px/틱 */
export const ENEMY_BULLET_SPEED = 512;
/**
 * 서 있는 적의 총알 높이(발에서 px). 총알 굵기(±BULLET_HALF)를 더해도 엎드린 대원 머리(발에서 CROUCH_H)보다 위,
 * 서 있는 대원(PLAYER_H) 안이다 — 엎드리면 피하고 서 있으면 맞는다.
 */
export const ENEMY_SHOT_Y = 18;
/** 적 총구가 몸 가운데에서 앞으로 나온 거리(px) */
export const ENEMY_GUN_X = 12;

/** 수류탄: 처음 개수, 던지는 속도, 다시 던질 수 있을 때까지, 터지기까지, 폭발 반경(px)·피해 */
export const START_GRENADES = 10;
export const GRENADE_VX = 640;
export const GRENADE_VY = -896;
export const GRENADE_TICKS = 24;
export const GRENADE_FUSE = 90;
export const BLAST_R = 28;
export const BLAST_DAMAGE = 4;

/**
 * 적 수류탄: 위로 던지는 속도(4.5px/틱) 고정, 가로 속도는 「대원 자리 ± 오차」에 LOB_FLIGHT 틱 만에 닿도록
 * (최대 LOB_MAX_VX). 오차는 난수 −LOB_SPREAD ~ +LOB_SPREAD px. 땅·발판에 닿거나 대원에게 닿으면 터진다.
 */
export const LOB_VY = -1152;
export const LOB_FLIGHT = 40;
export const LOB_MAX_VX = 1280;
export const LOB_SPREAD = 12;
export const ENEMY_FUSE = 120;
export const ENEMY_BLAST_R = 20;

export const START_LIVES = 3;
/** 맞은 뒤 다시 나올 때까지, 다시 나온 뒤 무적(틱) */
export const DEATH_TICKS = 60;
export const INVULN_TICKS = 120;

/** 동시 객체 상한 */
export const MAX_ENEMIES = 20;
export const MAX_BULLETS = 80;
export const MAX_GRENADES = 4;
export const MAX_ENEMY_GRENADES = 6;

/** 카메라: 대원이 화면 왼쪽에서 이만큼(px) 넘어가면 따라간다 */
export const CAM_LEAD = 150;
/** 적은 화면 오른쪽 끝 + 이만큼(px) 안에 들어오면 나타난다 */
export const SPAWN_MARGIN = 32;
/** 화면 왼쪽 끝 − 이만큼(px) 뒤로 처진 적·총알은 지운다 */
export const CULL_MARGIN = 32;

/** 점수 */
export const CRATE_POINTS = 50;
export const CLEAR_BONUS = 1000;
export const LIFE_BONUS = 500;

/** 판 하나의 최대 틱(10분) — 넘으면 판이 끝난다 */
export const MAX_TICKS = 10 * 60 * TICK_HZ;

/** 적 공격 방법 (곧게 쏘기 / 수류탄 던지기) */
export const ATTACK_SHOT = 0;
export const ATTACK_LOB = 1;

/** 적 종류별 크기·체력·점수·움직임·공격 (거리는 px, 시간은 틱) */
export interface EnemySpec {
    w: number;
    h: number;
    hp: number;
    points: number;
    /** 걷는 속도(단위/틱) — 0 이면 제자리 */
    speed: number;
    /** 대원과 이보다 가까우면 물러나고, 이보다 멀면 다가간다 */
    near: number;
    far: number;
    /** 처음 나와서 첫 공격까지 = first + 난수(0 ~ firstSpread−1) */
    first: number;
    firstSpread: number;
    /** 공격 간격 = every + 난수(0 ~ everySpread−1) — 걷는 동안만 센다 */
    every: number;
    everySpread: number;
    /** 공격 전 멈춰 겨누는 틱(예고), 공격 뒤 멈춰 있는 틱 */
    windup: number;
    recover: number;
    attack: number;
    /** 대원이 이 거리 안에 있을 때만 공격한다 */
    range: number;
}

export const ENEMY_SPECS: Record<number, EnemySpec> = {
    [ENEMY_DUMMY]: {
        w: 12,
        h: 22,
        hp: 2,
        points: 100,
        speed: 0,
        near: 0,
        far: 0,
        first: 60,
        firstSpread: 60,
        every: 150,
        everySpread: 90,
        windup: 0,
        recover: 0,
        attack: ATTACK_SHOT,
        range: VIEW_W
    },
    [ENEMY_RIFLE]: {
        w: 12,
        h: 22,
        hp: 2,
        points: 100,
        speed: 128,
        near: 72,
        far: 144,
        first: 45,
        firstSpread: 60,
        every: 120,
        everySpread: 90,
        windup: 24,
        recover: 14,
        attack: ATTACK_SHOT,
        range: VIEW_W
    },
    [ENEMY_THROWER]: {
        w: 12,
        h: 22,
        hp: 3,
        points: 150,
        speed: 96,
        near: 80,
        far: 150,
        first: 70,
        firstSpread: 60,
        every: 130,
        everySpread: 80,
        windup: 20,
        recover: 16,
        attack: ATTACK_LOB,
        range: 176
    }
};

/** 종류 번호의 규격 (모르는 번호면 표적병) */
export function enemySpec(kind: number): EnemySpec {
    return ENEMY_SPECS[kind] ?? ENEMY_SPECS[ENEMY_DUMMY];
}

/** 적 상태: 걷기 / 멈춰 겨누기(예고) / 공격 뒤 멈춤 */
export const MODE_WALK = 0;
export const MODE_WINDUP = 1;
export const MODE_RECOVER = 2;
/** 낭떠러지·벽·화면 끝에서 돌아선 뒤 대원 쪽으로 다시 방향을 고르지 않는 틱 */
export const TURN_TICKS = 40;
/** 적이 화면 왼쪽·오른쪽 끝에서 돌아서는 여유(px) */
export const EDGE_MARGIN = 4;
/** 곧게 쏘는 적이 「같은 높이」로 보는 발 높이 차(px) — 턱 한 칸(16px)보다 작다 */
export const LEVEL_TOLERANCE = 6;

export interface Player extends Body {
    prevX: number;
    prevY: number;
    /** 보는 쪽: 1 = 오른쪽, −1 = 왼쪽 */
    facing: number;
    crouch: boolean;
    aimUp: boolean;
    /** 공중에서 ↓ — 아래로 쏜다 */
    aimDown: boolean;
    fireCd: number;
    grenadeCd: number;
    grenades: number;
    /** 다시 나올 때까지 남은 틱 (0 = 살아 있음) */
    dead: number;
    invuln: number;
    /** 발판을 무시하고 내려가는 남은 틱 */
    drop: number;
    /** 땅에서 달린 틱 수 (그림 프레임용) */
    runTick: number;
    /** 방금 쏜 뒤 남은 틱 (총구 불꽃 그림용) */
    shotFlash: number;
}

/** 적 — 몸통(Body: 왼쪽 위·크기·속도, 단위)은 대원과 같은 중력·타일 충돌을 받는다 */
export interface Enemy extends Body {
    /** 그리기용 구분 번호 */
    id: number;
    kind: number;
    prevX: number;
    prevY: number;
    hp: number;
    /** 보는 쪽 (그림·총구) */
    facing: number;
    /** 걷는 쪽 */
    walkDir: number;
    /** 화면 안으로 다 들어온 적이 있는가 (그 뒤로는 화면 끝에서 돌아선다) */
    entered: boolean;
    /** MODE_* 와 그 남은 틱 */
    mode: number;
    modeT: number;
    /** 다음 공격까지 남은 틱 */
    fireT: number;
    /** 돌아선 뒤 남은 틱 (TURN_TICKS) */
    turnT: number;
    /** 걸은 틱 수 (그림 프레임용) */
    walkTick: number;
    /** 맞아서 번쩍이는 남은 틱 */
    hurt: number;
}

export const OWNER_PLAYER = 0;
export const OWNER_ENEMY = 1;

/** 총알 — x·y 는 가운데 (단위) */
export interface Bullet {
    owner: number;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    vx: number;
    vy: number;
}

/** 수류탄 — x·y 는 가운데 (단위). owner = OWNER_PLAYER 또는 OWNER_ENEMY */
export interface Grenade {
    owner: number;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    vx: number;
    vy: number;
    fuse: number;
}

/** 나타날 적 (단위 좌표, x 순서) */
export interface Spawn {
    kind: number;
    x: number;
    y: number;
}

export type EndReason = '' | 'lives' | 'clear' | 'limit';

export interface Game {
    seed: number;
    /** STAGES 번호 (시험용 스테이지면 −1) */
    stageId: number;
    /** 난수 상태 (uint32) */
    rng: number;
    tick: number;
    score: number;
    lives: number;
    kills: number;
    stage: StageDef;
    map: TileMap;
    /** 칸별 상자 체력 (상자가 아니면 0) */
    crateHp: number[];
    /** 카메라 왼쪽 끝 (단위) — 줄지 않는다 */
    camX: number;
    prevCamX: number;
    /** 다음 잠금 구간 번호 (stage.locks) */
    lockIdx: number;
    /** 지금 잠금 구간에 멈춰 있는가 */
    locked: boolean;
    player: Player;
    enemies: Enemy[];
    bullets: Bullet[];
    grenades: Grenade[];
    spawns: Spawn[];
    spawnIdx: number;
    nextId: number;
    /** 직전 틱 버튼 묶음 (누른 순간 알아내기용) */
    prevMask: number;
    over: boolean;
    reason: EndReason;
    log: InputLog;
}

/** 한 틱에 일어난 일 — 화면 효과·안내용 (규칙에는 영향 없음). 좌표는 단위 */
export type StepEvent =
    | { type: 'shot'; x: number; y: number }
    | { type: 'enemy-shot'; x: number; y: number }
    | { type: 'enemy-throw'; x: number; y: number }
    | { type: 'jump' }
    | { type: 'land' }
    | { type: 'throw' }
    | { type: 'hit'; x: number; y: number }
    | { type: 'kill'; x: number; y: number; kind: number; points: number }
    | { type: 'crate-hit'; x: number; y: number }
    | { type: 'crate-break'; x: number; y: number; points: number }
    | { type: 'boom'; x: number; y: number }
    | { type: 'die'; x: number; y: number }
    | { type: 'respawn' }
    | { type: 'lock' }
    | { type: 'unlock' }
    | { type: 'clear'; bonus: number }
    | { type: 'over'; reason: EndReason };

function nextRand(g: Game): number {
    const [s, u] = mulberry32(g.rng);
    g.rng = s;
    return u;
}

/** 0 ~ n−1 정수 난수 */
function randInt(g: Game, n: number): number {
    return nextRand(g) % n;
}

/** 대원 발 아래 가장자리 y (단위) */
export function feetY(p: Player): number {
    return p.y + p.h;
}

/** 대원 가운데 x (단위) */
export function centerX(p: Player): number {
    return p.x + idiv(p.w, 2);
}

/** 대원이 살아 있는가 (맞고 다시 나오기 전이 아님) */
export function playerAlive(g: Game): boolean {
    return !g.over && g.player.dead === 0;
}

/** 총구 위치와 쏘는 방향 [x, y, vx, vy] (단위) — 그림의 총구 자리와 맞춘다 */
export function muzzle(p: Player): [number, number, number, number] {
    const cx = centerX(p);
    const feet = feetY(p);
    if (p.aimDown) return [cx, feet + 2 * S, 0, BULLET_SPEED];
    if (p.aimUp) return [cx + p.facing * 7 * S, feet - 24 * S, 0, -BULLET_SPEED];
    if (p.crouch) return [cx + p.facing * 11 * S, feet - 5 * S, p.facing * BULLET_SPEED, 0];
    return [cx + p.facing * 11 * S, feet - 12 * S, p.facing * BULLET_SPEED, 0];
}

function newPlayer(def: StageDef): Player {
    const [col, row] = def.start;
    const x = col * TILE_U + idiv((TILE - PLAYER_W) * S, 2);
    const y = (row + 1) * TILE_U - PLAYER_H * S;
    return {
        x,
        y,
        w: PLAYER_W * S,
        h: PLAYER_H * S,
        vx: 0,
        vy: 0,
        onGround: false,
        prevX: x,
        prevY: y,
        facing: 1,
        crouch: false,
        aimUp: false,
        aimDown: false,
        fireCd: 0,
        grenadeCd: 0,
        grenades: START_GRENADES,
        dead: 0,
        invuln: 0,
        drop: 0,
        runTick: 0,
        shotFlash: 0
    };
}

/** 스테이지 번호가 STAGES 안에 있는가 */
export function isStageId(id: unknown): id is number {
    return Number.isSafeInteger(id) && (id as number) >= 0 && (id as number) < STAGES.length;
}

/**
 * 새 판. stage = STAGES 번호(기본 0) 또는 스테이지 정의(시험용).
 * 없는 번호면 RangeError — 재연은 replay() 가 먼저 걸러 낸다.
 */
export function createGame(seed: number, stageOrId: StageDef | number = 0): Game {
    if (typeof stageOrId === 'number' && !isStageId(stageOrId)) {
        throw new RangeError('unknown stage');
    }
    const stage = typeof stageOrId === 'number' ? STAGES[stageOrId] : stageOrId;
    const stageId = STAGES.indexOf(stage);
    const { map, crateHp } = buildMap(stage);
    const spawns: Spawn[] = stage.enemies
        .map((e) => {
            const spec = enemySpec(e.kind);
            return {
                kind: e.kind,
                x: e.col * TILE_U + idiv(TILE_U - spec.w * S, 2),
                y: (e.row + 1) * TILE_U - spec.h * S
            };
        })
        .sort((a, b) => a.x - b.x);
    const s = seed >>> 0;
    return {
        seed: s,
        stageId,
        rng: s,
        tick: 0,
        score: 0,
        lives: START_LIVES,
        kills: 0,
        stage,
        map,
        crateHp,
        camX: 0,
        prevCamX: 0,
        lockIdx: 0,
        locked: false,
        player: newPlayer(stage),
        enemies: [],
        bullets: [],
        grenades: [],
        spawns,
        spawnIdx: 0,
        nextId: 1,
        prevMask: 0,
        over: false,
        reason: '',
        log: { inputs: [] }
    };
}

function end(g: Game, reason: EndReason, ev: StepEvent[]): void {
    if (g.over) return;
    g.over = true;
    g.reason = reason;
    ev.push({ type: 'over', reason });
}

/** 총알 하나를 만든다 — 상한(MAX_BULLETS)이면 만들지 않고 false */
export function spawnBullet(
    g: Game,
    owner: number,
    x: number,
    y: number,
    vx: number,
    vy: number
): boolean {
    if (g.bullets.length >= MAX_BULLETS) return false;
    g.bullets.push({ owner, x, y, prevX: x, prevY: y, vx, vy });
    return true;
}

/** 적 하나를 만든다 — 상한(MAX_ENEMIES)이면 만들지 않고 null */
export function spawnEnemy(g: Game, kind: number, x: number, y: number): Enemy | null {
    if (g.enemies.length >= MAX_ENEMIES) return null;
    const spec = enemySpec(kind);
    const e: Enemy = {
        id: g.nextId++,
        kind,
        x,
        y,
        w: spec.w * S,
        h: spec.h * S,
        vx: 0,
        vy: 0,
        onGround: false,
        prevX: x,
        prevY: y,
        hp: spec.hp,
        facing: -1,
        walkDir: -1,
        entered: false,
        mode: MODE_WALK,
        modeT: 0,
        // 종류마다 첫 공격 시각이 다르다
        fireT: spec.first + (spec.firstSpread > 0 ? randInt(g, spec.firstSpread) : 0),
        turnT: 0,
        walkTick: 0,
        hurt: 0
    };
    g.enemies.push(e);
    return e;
}

/* ── 맞기·부서지기 ── */

function killPlayer(g: Game, ev: StepEvent[]): void {
    const p = g.player;
    if (p.dead > 0 || g.over) return;
    g.lives--;
    p.dead = DEATH_TICKS;
    p.vx = 0;
    p.vy = 0;
    p.shotFlash = 0;
    ev.push({ type: 'die', x: centerX(p), y: p.y + idiv(p.h, 2) });
}

function damageEnemy(g: Game, e: Enemy, dmg: number, ev: StepEvent[]): void {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hurt = 6;
    const x = e.x + idiv(e.w, 2);
    const y = e.y + idiv(e.h, 2);
    if (e.hp > 0) {
        ev.push({ type: 'hit', x, y });
        return;
    }
    const points = enemySpec(e.kind).points;
    g.score += points;
    g.kills++;
    ev.push({ type: 'kill', x, y, kind: e.kind, points });
}

/** 상자 칸에 피해 — 체력이 다하면 빈칸이 된다 */
function damageCrate(g: Game, col: number, row: number, dmg: number, ev: StepEvent[]): void {
    if (tileAt(g.map, col, row) !== T_CRATE) return;
    const i = row * g.map.cols + col;
    g.crateHp[i] -= dmg;
    const x = col * TILE_U + idiv(TILE_U, 2);
    const y = row * TILE_U + idiv(TILE_U, 2);
    if (g.crateHp[i] > 0) {
        ev.push({ type: 'crate-hit', x, y });
        return;
    }
    g.crateHp[i] = 0;
    g.map.tiles[i] = T_EMPTY;
    g.score += CRATE_POINTS;
    ev.push({ type: 'crate-break', x, y, points: CRATE_POINTS });
}

/**
 * 폭발. 대원 수류탄 = 반경 BLAST_R 안의 적·상자에 피해(대원은 안 다친다).
 * 적 수류탄 = 반경 ENEMY_BLAST_R 안의 대원만 맞는다(적끼리·상자는 그대로 — 엄폐물이 남는다).
 */
function explode(g: Game, x: number, y: number, owner: number, ev: StepEvent[]): void {
    ev.push({ type: 'boom', x, y });
    if (owner === OWNER_ENEMY) {
        const er = ENEMY_BLAST_R * S;
        const p = g.player;
        if (
            playerAlive(g) &&
            p.invuln === 0 &&
            boxesOverlap(x - er, y - er, 2 * er, 2 * er, p.x, p.y, p.w, p.h)
        ) {
            killPlayer(g, ev);
        }
        return;
    }
    const r = BLAST_R * S;
    for (const e of g.enemies) {
        if (boxesOverlap(x - r, y - r, 2 * r, 2 * r, e.x, e.y, e.w, e.h)) {
            damageEnemy(g, e, BLAST_DAMAGE, ev);
        }
    }
    const c0 = fdiv(x - r, TILE_U);
    const c1 = fdiv(x + r - 1, TILE_U);
    const r0 = fdiv(y - r, TILE_U);
    const r1 = fdiv(y + r - 1, TILE_U);
    for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) damageCrate(g, col, row, BLAST_DAMAGE, ev);
    }
}

/* ── 대원 ── */

/** 엎드리기·일어서기 — 일어설 자리(머리 위)가 막혀 있으면 엎드린 채로 둔다 */
function setCrouch(g: Game, want: boolean): void {
    const p = g.player;
    if (want === p.crouch) return;
    const dh = (PLAYER_H - CROUCH_H) * S;
    if (want) {
        p.crouch = true;
        p.h = CROUCH_H * S;
        p.y += dh;
    } else {
        if (boxHitsSolid(g.map, p.x, p.y - dh, p.w, PLAYER_H * S)) return;
        p.crouch = false;
        p.h = PLAYER_H * S;
        p.y -= dh;
    }
}

/** x~x+w 아래 어딘가에 땅(바위·상자 포함)이 있는가 — 없으면 구덩이 */
function groundBelow(map: TileMap, x: number, w: number): boolean {
    const c0 = fdiv(x, TILE_U);
    const c1 = fdiv(x + w - 1, TILE_U);
    for (let c = c0; c <= c1; c++) {
        for (let r = 0; r < map.rows; r++) if (tileAt(map, c, r) === T_SOLID) return true;
    }
    return false;
}

function respawn(g: Game, ev: StepEvent[]): void {
    const p = g.player;
    p.crouch = false;
    p.h = PLAYER_H * S;
    p.x = g.camX + 40 * S;
    p.y = TILE_U;
    // 다시 나올 자리가 막혀 있거나 아래가 구덩이면 오른쪽으로 한 칸씩 (화면 안에서)
    for (
        let k = 0;
        k < 8 && (boxHitsSolid(g.map, p.x, p.y, p.w, p.h) || !groundBelow(g.map, p.x, p.w));
        k++
    ) {
        p.x += TILE_U;
    }
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx = 0;
    p.vy = 0;
    p.onGround = false;
    p.aimUp = false;
    p.aimDown = false;
    p.drop = 0;
    p.fireCd = 0;
    p.grenadeCd = 0;
    p.grenades = START_GRENADES;
    p.invuln = INVULN_TICKS;
    ev.push({ type: 'respawn' });
}

function fire(g: Game, ev: StepEvent[]): void {
    const p = g.player;
    const [x, y, vx, vy] = muzzle(p);
    if (!spawnBullet(g, OWNER_PLAYER, x, y, vx, vy)) return;
    p.fireCd = FIRE_TICKS;
    p.shotFlash = 4;
    ev.push({ type: 'shot', x, y });
}

/** 날아가는 수류탄 수 (주인별) */
export function countGrenades(g: Game, owner: number): number {
    let n = 0;
    for (const gr of g.grenades) if (gr.owner === owner) n++;
    return n;
}

function throwGrenade(g: Game, ev: StepEvent[]): void {
    const p = g.player;
    const x = centerX(p) + p.facing * 6 * S;
    const y = feetY(p) - (p.crouch ? 8 : 16) * S;
    // 위 조준이면 높이·짧게, 아니면 앞으로 멀리
    const vx = p.aimUp ? p.facing * idiv(GRENADE_VX, 2) : p.facing * GRENADE_VX;
    const vy = p.aimUp ? GRENADE_VY - 384 : GRENADE_VY;
    g.grenades.push({ owner: OWNER_PLAYER, x, y, prevX: x, prevY: y, vx, vy, fuse: GRENADE_FUSE });
    p.grenades--;
    p.grenadeCd = GRENADE_TICKS;
    ev.push({ type: 'throw' });
}

function updatePlayer(g: Game, mask: number, ev: StepEvent[]): void {
    const p = g.player;
    if (p.dead > 0) {
        if (--p.dead === 0) {
            if (g.lives <= 0) end(g, 'lives', ev);
            else respawn(g, ev);
        }
        return;
    }
    const pressed = mask & ~g.prevMask;
    if (p.invuln > 0) p.invuln--;
    if (p.fireCd > 0) p.fireCd--;
    if (p.grenadeCd > 0) p.grenadeCd--;
    if (p.shotFlash > 0) p.shotFlash--;

    const dir = (mask & BTN_RIGHT ? 1 : 0) - (mask & BTN_LEFT ? 1 : 0);
    if (dir !== 0) p.facing = dir;

    setCrouch(g, (mask & BTN_DOWN) !== 0 && p.onGround);
    p.aimUp = (mask & BTN_UP) !== 0 && !p.crouch;
    p.aimDown = (mask & BTN_DOWN) !== 0 && !p.onGround;

    // 점프 — 누른 순간에만. 엎드린 채 발판 위면 발판 아래로 내려간다
    if (pressed & BTN_JUMP && p.onGround) {
        if (p.crouch && onPlatformOnly(g.map, p)) {
            p.drop = DROP_TICKS;
        } else {
            setCrouch(g, false);
            if (!p.crouch) {
                p.vy = -JUMP_V;
                ev.push({ type: 'jump' });
            }
        }
    }
    // 일찍 떼면 낮게 — 위로 가는 속도를 자른다
    if ((mask & BTN_JUMP) === 0 && p.vy < -JUMP_CUT) p.vy = -JUMP_CUT;
    p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);
    p.vx = dir * (p.crouch ? CROUCH_SPEED : RUN_SPEED);

    moveX(g.map, p, p.vx);
    // 화면 왼쪽 끝 밖으로는 못 간다. 잠금 구간이면 오른쪽 끝도
    if (p.x < g.camX) p.x = g.camX;
    const right = g.camX + VIEW_W * S - p.w;
    if (g.locked && p.x > right) p.x = right;

    const wasGround = p.onGround;
    moveY(g.map, p, p.vy, p.drop > 0);
    if (p.drop > 0) p.drop--;
    if (p.onGround && !wasGround) ev.push({ type: 'land' });
    p.runTick = p.onGround && p.vx !== 0 ? p.runTick + 1 : 0;

    // 구덩이에 떨어지면 맞은 것과 같다
    if (p.y > g.map.rows * TILE_U) {
        killPlayer(g, ev);
        return;
    }

    if (
        ((mask & BTN_FIRE) !== 0 && p.fireCd === 0) ||
        ((pressed & BTN_FIRE) !== 0 && p.fireCd <= FIRE_TICKS - TAP_FIRE_TICKS)
    ) {
        fire(g, ev);
    }
    if (
        pressed & BTN_GRENADE &&
        p.grenades > 0 &&
        p.grenadeCd === 0 &&
        countGrenades(g, OWNER_PLAYER) < MAX_GRENADES
    ) {
        throwGrenade(g, ev);
    }
}

/* ── 카메라·잠금 구간·적 등장 ── */

function updateCamera(g: Game, ev: StepEvent[]): void {
    const p = g.player;
    g.prevCamX = g.camX;
    let limit = (g.map.cols * TILE - VIEW_W) * S;
    const lockAt = g.lockIdx < g.stage.locks.length ? g.stage.locks[g.lockIdx] * TILE_U : -1;
    if (lockAt >= 0 && lockAt < limit) limit = lockAt;
    if (p.dead === 0) {
        const target = centerX(p) - CAM_LEAD * S;
        if (target > g.camX) g.camX = Math.min(target, limit);
    }
    if (lockAt >= 0 && g.camX >= lockAt && !g.locked) {
        g.locked = true;
        ev.push({ type: 'lock' });
    }
}

function spawnEnemies(g: Game): void {
    const edge = g.camX + (VIEW_W + SPAWN_MARGIN) * S;
    while (g.spawnIdx < g.spawns.length && g.spawns[g.spawnIdx].x < edge) {
        const s = g.spawns[g.spawnIdx];
        if (!spawnEnemy(g, s.kind, s.x, s.y)) break;
        g.spawnIdx++;
    }
}

/**
 * 잠금 구간: 이 화면(왼쪽 끝 = 잠금 열, 너비 VIEW_W) 안에 나온 적이 없고, 그 안에서 나올 적도 남지 않으면 풀린다.
 * 화면 오른쪽 밖에 미리 나와 있는 다음 구간 적은 세지 않는다.
 */
function updateLock(g: Game, ev: StepEvent[]): void {
    if (!g.locked) return;
    const lockEnd = g.stage.locks[g.lockIdx] * TILE_U + VIEW_W * S;
    const pending = g.spawnIdx < g.spawns.length && g.spawns[g.spawnIdx].x < lockEnd;
    if (pending) return;
    for (const e of g.enemies) if (e.x < lockEnd) return;
    g.locked = false;
    g.lockIdx++;
    ev.push({ type: 'unlock' });
}

/* ── 적 ── */

function onScreen(g: Game, x: number, w: number): boolean {
    return x + w > g.camX && x < g.camX + VIEW_W * S;
}

/** 걷는 적의 앞이 막혔거나(벽) 발 앞이 비었는가(낭떠러지) — dir 쪽으로 2px 앞을 본다 */
function blockedAhead(map: TileMap, e: Enemy, dir: number): boolean {
    const x = dir > 0 ? e.x + e.w - 1 + 2 * S : e.x - 2 * S;
    const col = fdiv(x, TILE_U);
    const feet = e.y + e.h;
    if (isSolid(tileAt(map, col, fdiv(feet - 1, TILE_U)))) return true;
    if (isSolid(tileAt(map, col, fdiv(e.y, TILE_U)))) return true;
    if (!e.onGround) return false;
    const below = tileAt(map, col, fdiv(feet, TILE_U));
    return !isSolid(below) && below !== T_PLATFORM;
}

/**
 * 걷는 쪽을 정하고 이번 틱 가로 속도를 돌려준다.
 * - 화면에 다 들어오기 전에는 왼쪽(대원 쪽)으로 들어온다.
 * - 대원이 멀면(far) 다가가고 가까우면(near) 물러난다. 돌아선 뒤 TURN_TICKS 동안은 그대로 걷는다.
 * - 낭떠러지·벽·화면 끝에서 돌아선다(구덩이에 떨어지거나 화면 밖으로 나가지 않는다).
 */
function walkVelocity(g: Game, e: Enemy, spec: EnemySpec, dx: number): number {
    if (!e.entered) {
        if (e.x + e.w <= g.camX + VIEW_W * S) {
            e.entered = true;
        } else {
            e.walkDir = -1;
            e.facing = -1;
            return blockedAhead(g.map, e, -1) ? 0 : -spec.speed;
        }
    }
    const left = g.camX + EDGE_MARGIN * S;
    const right = g.camX + (VIEW_W - EDGE_MARGIN) * S;
    const toward = dx < 0 ? -1 : 1;
    const dist = Math.abs(dx);
    if (e.turnT > 0) e.turnT--;
    else if (playerAlive(g)) {
        if (dist > spec.far * S) e.walkDir = toward;
        else if (dist < spec.near * S) e.walkDir = -toward;
    }
    const atEdge = (e.walkDir < 0 && e.x < left) || (e.walkDir > 0 && e.x + e.w > right);
    if (atEdge || blockedAhead(g.map, e, e.walkDir)) {
        e.walkDir = -e.walkDir;
        e.turnT = TURN_TICKS;
        if (blockedAhead(g.map, e, e.walkDir)) {
            if (playerAlive(g)) e.facing = toward;
            return 0;
        }
    }
    e.facing = e.walkDir;
    return e.walkDir * spec.speed;
}

/** 적의 공격 — 곧게 한 발 또는 수류탄 하나 (시험에서도 부른다) */
export function enemyAttack(g: Game, e: Enemy, ev: StepEvent[]): void {
    const spec = enemySpec(e.kind);
    const ecx = e.x + idiv(e.w, 2);
    const feet = e.y + e.h;
    if (spec.attack === ATTACK_LOB) {
        if (countGrenades(g, OWNER_ENEMY) >= MAX_ENEMY_GRENADES) return;
        const x = ecx + e.facing * 4 * S;
        const y = feet - 20 * S;
        const aim = centerX(g.player) + (randInt(g, 2 * LOB_SPREAD + 1) - LOB_SPREAD) * S;
        let vx = idiv(aim - x, LOB_FLIGHT);
        if (vx > LOB_MAX_VX) vx = LOB_MAX_VX;
        if (vx < -LOB_MAX_VX) vx = -LOB_MAX_VX;
        g.grenades.push({
            owner: OWNER_ENEMY,
            x,
            y,
            prevX: x,
            prevY: y,
            vx,
            vy: LOB_VY,
            fuse: ENEMY_FUSE
        });
        ev.push({ type: 'enemy-throw', x, y });
        return;
    }
    const x = ecx + e.facing * ENEMY_GUN_X * S;
    const y = feet - ENEMY_SHOT_Y * S;
    if (spawnBullet(g, OWNER_ENEMY, x, y, e.facing * ENEMY_BULLET_SPEED, 0)) {
        ev.push({ type: 'enemy-shot', x, y });
    }
}

function updateEnemy(g: Game, e: Enemy, ev: StepEvent[]): void {
    // 이번 틱에 이미 잡힌 적은 움직이지 않는다
    if (e.hp <= 0) return;
    if (e.hurt > 0) e.hurt--;
    const spec = enemySpec(e.kind);
    const alive = playerAlive(g);
    const seen = onScreen(g, e.x, e.w);
    const dx = centerX(g.player) - (e.x + idiv(e.w, 2));
    const toward = dx < 0 ? -1 : 1;
    let vx = 0;

    if (e.mode === MODE_WINDUP) {
        // 멈춰 겨눈다(예고) — 끝나면 공격
        if (alive) e.facing = toward;
        if (--e.modeT <= 0) {
            if (alive && seen) enemyAttack(g, e, ev);
            e.mode = MODE_RECOVER;
            e.modeT = spec.recover;
        }
    } else if (e.mode === MODE_RECOVER) {
        if (--e.modeT <= 0) e.mode = MODE_WALK;
    } else {
        if (spec.speed > 0) vx = walkVelocity(g, e, spec, dx);
        else if (alive) e.facing = toward;
        // 화면 안에서, 대원이 살아 있을 때만 공격 시각을 센다
        if (seen && alive && --e.fireT <= 0) {
            // 곧게 쏘는 적은 대원 발이 자기 발과 같은 높이일 때만 쏜다 — 턱 위·아래에서 발목을 맞혀
            // 엎드려도 못 피하는 총알이 없게
            const level =
                spec.attack !== ATTACK_SHOT ||
                Math.abs(feetY(g.player) - (e.y + e.h)) <= LEVEL_TOLERANCE * S;
            if (level && Math.abs(dx) <= spec.range * S) {
                e.fireT = spec.every + randInt(g, spec.everySpread);
                e.facing = toward;
                if (spec.windup > 0) {
                    e.mode = MODE_WINDUP;
                    e.modeT = spec.windup;
                    vx = 0;
                } else {
                    enemyAttack(g, e, ev);
                }
            } else {
                // 멀면 조금 뒤에 다시 본다
                e.fireT = 20;
            }
        }
    }

    // 걷기·중력 (대원과 같은 타일 충돌)
    e.vx = vx;
    if (vx !== 0) {
        if (moveX(g.map, e, vx)) {
            e.walkDir = -e.walkDir;
            e.turnT = TURN_TICKS;
        }
        e.walkTick++;
    }
    e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
    moveY(g.map, e, e.vy);
    // 상자가 부서져 구덩이로 떨어진 적은 점수 없이 사라진다
    if (e.y > g.map.rows * TILE_U) e.hp = 0;
}

/* ── 총알·수류탄 ── */

function bulletGone(g: Game, b: Bullet): boolean {
    const m = CULL_MARGIN * S;
    return (
        b.x < g.camX - m ||
        b.x > g.camX + VIEW_W * S + m ||
        b.y < -m ||
        b.y > g.map.rows * TILE_U + m
    );
}

function moveBullets(g: Game, ev: StepEvent[]): void {
    const p = g.player;
    const half = BULLET_HALF * S;
    let w = 0;
    for (const b of g.bullets) {
        b.prevX = b.x;
        b.prevY = b.y;
        b.x += b.vx;
        b.y += b.vy;
        // 땅·상자에 막힘 (발판은 통과). 한 틱 6px < 타일 16px 이라 건너뛰지 않는다
        const col = fdiv(b.x, TILE_U);
        const row = fdiv(b.y, TILE_U);
        const t = tileAt(g.map, col, row);
        if (isSolid(t)) {
            if (t === T_CRATE) damageCrate(g, col, row, 1, ev);
            continue;
        }
        // 이번 틱에 지나온 길 전체
        const l = Math.min(b.prevX, b.x) - half;
        const top = Math.min(b.prevY, b.y) - half;
        const bw = Math.abs(b.x - b.prevX) + 2 * half;
        const bh = Math.abs(b.y - b.prevY) + 2 * half;
        let hit = false;
        if (b.owner === OWNER_PLAYER) {
            for (const e of g.enemies) {
                if (e.hp > 0 && boxesOverlap(l, top, bw, bh, e.x, e.y, e.w, e.h)) {
                    damageEnemy(g, e, 1, ev);
                    hit = true;
                    break;
                }
            }
        } else if (playerAlive(g) && p.invuln === 0) {
            if (boxesOverlap(l, top, bw, bh, p.x, p.y, p.w, p.h)) {
                killPlayer(g, ev);
                hit = true;
            }
        }
        if (hit || bulletGone(g, b)) continue;
        g.bullets[w++] = b;
    }
    g.bullets.length = w;
}

function moveGrenades(g: Game, ev: StepEvent[]): void {
    let w = 0;
    for (const gr of g.grenades) {
        gr.prevX = gr.x;
        gr.prevY = gr.y;
        gr.vy = Math.min(gr.vy + GRAVITY, MAX_FALL);
        // 벽에 부딪히면 반쯤 튕겨 나온다
        const nx = gr.x + gr.vx;
        if (isSolid(tileAt(g.map, fdiv(nx, TILE_U), fdiv(gr.y, TILE_U)))) gr.vx = idiv(-gr.vx, 2);
        else gr.x = nx;
        const ny = gr.y + gr.vy;
        const t = tileAt(g.map, fdiv(gr.x, TILE_U), fdiv(ny, TILE_U));
        const crossedPlatform =
            t === T_PLATFORM && gr.vy > 0 && fdiv(gr.y, TILE_U) < fdiv(ny, TILE_U);
        let boom = false;
        if (isSolid(t) || crossedPlatform) {
            if (gr.vy > 0) {
                // 땅·발판에 닿으면 그 위에서 터진다
                gr.y = fdiv(ny, TILE_U) * TILE_U - S;
                boom = true;
            } else {
                gr.vy = 0;
            }
        } else {
            gr.y = ny;
        }
        if (!boom && gr.owner === OWNER_PLAYER) {
            // 내 수류탄은 적에게 닿으면 터진다
            for (const e of g.enemies) {
                if (
                    e.hp > 0 &&
                    boxesOverlap(gr.x - S, gr.y - S, 2 * S, 2 * S, e.x, e.y, e.w, e.h)
                ) {
                    boom = true;
                    break;
                }
            }
        } else if (!boom) {
            // 적 수류탄은 대원에게 닿으면 터진다
            const p = g.player;
            if (
                playerAlive(g) &&
                boxesOverlap(gr.x - S, gr.y - S, 2 * S, 2 * S, p.x, p.y, p.w, p.h)
            ) {
                boom = true;
            }
        }
        if (!boom && --gr.fuse <= 0) boom = true;
        if (boom) {
            explode(g, gr.x, gr.y, gr.owner, ev);
            continue;
        }
        if (gr.y > g.map.rows * TILE_U || gr.x < g.camX - CULL_MARGIN * S) continue;
        g.grenades[w++] = gr;
    }
    g.grenades.length = w;
}

/** 잡힌 적·뒤로 처진 적을 지운다 */
function sweepEnemies(g: Game): void {
    const left = g.camX - CULL_MARGIN * S;
    let w = 0;
    for (const e of g.enemies) {
        if (e.hp <= 0 || e.x + e.w < left) continue;
        g.enemies[w++] = e;
    }
    g.enemies.length = w;
}

/** 한 틱 진행. mask = 버튼 묶음(input.ts). 끝난 판이면 아무것도 하지 않는다 */
export function step(g: Game, mask: number): StepEvent[] {
    const ev: StepEvent[] = [];
    if (g.over) return ev;

    const m = normalizeMask(Math.trunc(Number(mask)) || 0);
    if (m !== g.prevMask) g.log.inputs.push(g.tick, m);

    const p = g.player;
    p.prevX = p.x;
    p.prevY = p.y;
    for (const e of g.enemies) {
        e.prevX = e.x;
        e.prevY = e.y;
    }

    // 1) 대원 (이동·사격·수류탄)
    updatePlayer(g, m, ev);
    g.prevMask = m;

    if (!g.over) {
        // 2) 카메라·적 등장·잠금
        updateCamera(g, ev);
        spawnEnemies(g);

        // 3) 적
        for (const e of g.enemies) updateEnemy(g, e, ev);

        // 4) 총알·수류탄
        moveBullets(g, ev);
        moveGrenades(g, ev);
        sweepEnemies(g);
        updateLock(g, ev);

        // 5) 구간 끝
        if (playerAlive(g) && centerX(p) >= g.stage.goal * TILE_U) {
            const bonus = CLEAR_BONUS + g.lives * LIFE_BONUS;
            g.score += bonus;
            ev.push({ type: 'clear', bonus });
            end(g, 'clear', ev);
        }
    }

    g.tick++;
    if (!g.over && g.tick >= MAX_TICKS) end(g, 'limit', ev);
    return ev;
}

/** 재연 거부 이유 */
export type ReplayError =
    | ''
    /** 기록 모양이 틀림(배열 아님·정수 아님·길이 홀수) */
    | 'bad-log'
    /** 판 길이가 0~MAX_TICKS 정수가 아님 */
    | 'bad-ticks'
    /** 스테이지 번호가 STAGES 밖 (정수 아님 포함) */
    | 'bad-stage'
    /** 틱이 커지는 순서가 아니거나 같은 틱이 두 번 */
    | 'tick-order'
    /** 버튼 묶음이 0~127 밖이거나 반대 방향을 함께 누른 모양(엔진은 그렇게 남기지 않는다) */
    | 'mask-range'
    /** 바로 앞 값과 같은 묶음 (엔진은 바뀐 틱만 남긴다) */
    | 'mask-unchanged'
    /** 판 길이를 넘는 틱의 입력 */
    | 'tick-range'
    /** 판이 끝난 틱과 판 길이가 다름 */
    | 'length';

export interface ReplayResult {
    ok: boolean;
    error: ReplayError;
    /** 거부된 경우 거부 직전까지 돌린 판 */
    game: Game;
}

function isIntList(v: unknown): v is number[] {
    return Array.isArray(v) && v.every((n) => Number.isSafeInteger(n));
}

/** 기록 모양만 본다 (판을 돌리지 않고 알 수 있는 것) */
function checkLog(log: InputLog, ticks: number): ReplayError {
    if (!log || !isIntList(log.inputs) || log.inputs.length % 2 !== 0) return 'bad-log';
    if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > MAX_TICKS) return 'bad-ticks';
    let prevTick = -1;
    let prevMask = 0;
    for (let k = 0; k < log.inputs.length; k += 2) {
        const t = log.inputs[k];
        const m = log.inputs[k + 1];
        if (t <= prevTick) return 'tick-order';
        if (t >= ticks) return 'tick-range';
        if (m < 0 || normalizeMask(m) !== m) return 'mask-range';
        if (m === prevMask) return 'mask-unchanged';
        prevTick = t;
        prevMask = m;
    }
    return '';
}

/**
 * 입력 기록으로 stageId 번 스테이지 판을 처음부터 다시 돌린다 — 판 길이 ticks 까지.
 * 기록이 엔진이 남기는 모양과 다르면(순서·범위·중복·길이) 조용히 넘기지 않고
 * ok=false 와 이유를 돌려준다.
 */
export function replay(seed: number, log: InputLog, ticks: number, stageId: number): ReplayResult {
    if (!isStageId(stageId)) return { ok: false, error: 'bad-stage', game: createGame(seed, 0) };
    const g = createGame(seed, stageId);
    const bad = checkLog(log, ticks);
    if (bad) return { ok: false, error: bad, game: g };
    const read = createLogReader(log);
    for (let t = 0; t < ticks; t++) {
        if (g.over) return { ok: false, error: 'length', game: g };
        step(g, read(t));
    }
    return { ok: true, error: '', game: g };
}

/** 버튼 이름 (도움말·시험용) */
export const BUTTONS = {
    left: BTN_LEFT,
    right: BTN_RIGHT,
    up: BTN_UP,
    down: BTN_DOWN,
    fire: BTN_FIRE,
    jump: BTN_JUMP,
    grenade: BTN_GRENADE
} as const;

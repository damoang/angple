/**
 * 앙 스트라이커 규칙 — DOM 없음, 결정적(deterministic).
 *
 * 같은 seed 와 같은 입력 기록을 넣으면 어느 기기에서 돌려도 같은 판·같은 점수가 나온다.
 * (2단계에서 서버가 같은 규칙으로 끝난 판을 다시 돌려 점수를 확인할 수 있게 하려는 것.)
 *
 * 결정성을 위한 약속
 * - 고정 틱 60회/초. 한 번의 step() = 한 틱. 시간(Date·performance)을 읽지 않는다.
 * - 좌표·속도는 모두 정수(고정소수점: 논리 1px = SCALE 단위). 부동소수점 계산 결과를 상태에 넣지 않는다.
 *   나눗셈은 idiv(0 쪽으로 버림) 하나만 쓴다 — Go 의 정수 나눗셈과 같다.
 * - 적 비행은 미리 정한 베지어 곡선 표(paths.ts)를 틱 단위로 따라간다.
 * - 난수는 seed 에서 시작하는 mulberry32 하나뿐이고, 급강하 순서·노리는 자리·적 사격·아이템에만 쓴다.
 *
 * 판(논리 좌표)
 * - 가로 360 × 세로 640. 내 비행기 가운데 y=576 (그 아래 64px 는 손가락으로 끄는 자리).
 * - 편대 10칸 × 5줄 (stages.ts). 적은 동시에 최대 40, 총알은 내 것 5 + 적 55 = 60 이 상한.
 *
 * 충돌
 * - 모두 축에 나란한 사각형 겹침. 가장자리에 딱 닿은 것은 겹침이 아니다.
 * - 총알은 「이번 틱에 지나온 길 전체」(직전 위치~지금 위치를 덮는 사각형)로 검사한다.
 *   한 틱에 아무리 멀리 가도 그 사이에 있던 적·비행기를 건너뛰지 못한다(터널링 없음).
 *
 * 입력 기록(GameLog) — 2단계 서버 재연용, 아직 어디에도 보내지 않는다.
 * - moves: [틱, x, 틱, x, …] 비행기 목표 x(논리 px 정수 0~360)가 「바뀐 틱만」. 처음 값은 180.
 * - 사격은 자동이라 기록할 것이 없다. 판 길이는 game.tick.
 *   replay(seed, log, tick) 으로 같은 판을 다시 만든다(어긋난 기록은 거부).
 */
import {
    BONUS_HIT_POINTS,
    BONUS_PERFECT,
    DIVE_POINTS,
    DROP_PERCENT,
    ENEMY_BOSS,
    ENEMY_GRUNT,
    ENEMY_MID,
    EXTEND_AT,
    FORM_COLS,
    FORM_DX,
    FORM_DY,
    FORM_LEFT,
    FORM_POINTS,
    FORM_TOP,
    ITEM_POINTS,
    ITEM_RAPID,
    ITEM_SHIELD,
    LAYOUTS,
    SQUAD_BONUS,
    bulletSpeed,
    diveInterval,
    diveTicks,
    enemyHp,
    enemyKindOf,
    fireChance,
    isBonusStage,
    itemKindFor,
    maxDivers,
    secondShotChance
} from './stages';
import {
    BONUS_PATHS,
    ENTRY_PATHS,
    divePath,
    idiv,
    pathPoint,
    pathTicks,
    shiftPath,
    toPath
} from './paths';

export { idiv };

/** 논리 1px 의 고정소수점 단위 */
export const SCALE = 256;
/** 1초 틱 수 */
export const TICK_HZ = 60;

export const FIELD_W = 360;
export const FIELD_H = 640;

/** 내 비행기 가운데 y, 그림 반폭, 맞는 상자 반폭(그림보다 작게 — 스친 총알은 봐준다) */
export const SHIP_Y = 576;
export const SHIP_HALF_W = 13;
export const SHIP_HIT = 7;
/** 비행기가 한 틱에 갈 수 있는 최대 거리(px) */
export const SHIP_SPEED = 8;
/** 입력이 없을 때의 비행기 x (= 입력 기록의 시작 값) */
export const START_X = FIELD_W / 2;

/** 내 총알: 속력(px/틱), 반폭·반높이, 동시에 있을 수 있는 수, 쏘는 간격(틱) */
export const SHOT_SPEED = 12;
export const SHOT_HW = 2;
export const SHOT_HH = 6;
export const MAX_SHOTS = 3;
export const RAPID_SHOTS = 5;
export const FIRE_TICKS = 10;
export const RAPID_FIRE_TICKS = 6;
/** 연사 강화 지속 시간(틱) */
export const RAPID_TICKS = 15 * TICK_HZ;

/** 적 총알 반폭·반높이와 동시에 있을 수 있는 수 */
export const EBULLET_HW = 2;
export const EBULLET_HH = 4;
export const MAX_ENEMY_BULLETS = 55;
/** 화면에 동시에 있을 수 있는 총알 수(내 것 + 적) */
export const MAX_BULLETS = RAPID_SHOTS + MAX_ENEMY_BULLETS;
/** 적이 이 높이(px)보다 비행기에 가까우면 쏘지 않는다 — 코앞에서 피할 수 없는 총알 방지 */
export const FIRE_MIN_GAP = 160;

/** 동시에 있을 수 있는 적 수 */
export const MAX_ENEMIES = 40;
/** 적 맞는 상자 반폭(졸개·중간 / 대장) */
export const ENEMY_HALF = 10;
export const BOSS_HALF = 12;

/** 아이템 반폭, 떨어지는 속도(단위/틱) */
export const ITEM_HALF = 8;
export const ITEM_FALL = 384;

export const START_LIVES = 3;
export const MAX_LIVES = 9;
/** 맞은 뒤 다시 나올 때까지, 다시 나온 뒤 무적 시간, 방패가 막아 준 뒤 무적 시간(틱) */
export const RESPAWN_TICKS = 90;
export const INVULN_TICKS = 120;
export const SHIELD_INVULN_TICKS = 60;

/** 편대로 날아가 자리 잡는 속력(px/틱) */
export const HOME_SPEED = 4;
/** 편대 흔들림: 주기(틱), 좌우 폭(px) */
export const SWAY_TICKS = 240;
export const SWAY_PX = 16;

/** 입장: 첫 무리 출발 틱, 무리 사이 간격, 무리 안 한 마리씩 간격 */
export const WAVE_START = 20;
export const WAVE_GAP = 90;
export const MEMBER_GAP = 8;
/** 보너스 스테이지: 무리 수, 한 무리 마리 수, 무리 사이 간격, 한 마리씩 간격 */
export const BONUS_WAVES = 5;
export const BONUS_WAVE_SIZE = 8;
export const BONUS_WAVE_GAP = 110;
export const BONUS_MEMBER_GAP = 10;

/** 모두 자리 잡은 뒤 첫 급강하까지(틱) */
export const FIRST_DIVE_TICKS = 90;
/** 급강하가 노리는 x 의 흔들림(±px) */
export const AIM_SPREAD = 40;
/** 스테이지를 깬 뒤 다음 스테이지까지(틱) */
export const STAGE_GAP_TICKS = 120;
/** 판 하나의 최대 틱(1시간) — 넘으면 판이 끝난다 */
export const MAX_TICKS = 60 * 60 * TICK_HZ;

/** 적 상태 */
export const M_WAIT = 0;
export const M_ENTER = 1;
export const M_HOME = 2;
export const M_FORM = 3;
export const M_DIVE = 4;
export const M_FLY = 5;

/** 판 상태 */
export const PH_PLAY = 0;
export const PH_CLEAR = 1;

const S = SCALE;
const FW = FIELD_W * S;
const FH = FIELD_H * S;
const SHIP_YU = SHIP_Y * S;

export interface Enemy {
    /** 그리기용 구분 번호 */
    id: number;
    kind: number;
    hp: number;
    /** 편대 칸(줄 × 10 + 칸). 보너스 스테이지 적은 −1 */
    slot: number;
    mode: number;
    x: number;
    y: number;
    /** 직전 틱 끝 위치(그리기 보간용) */
    px: number;
    py: number;
    /** 따라가는 경로(paths.ts 모양, 단위)와 그 위의 틱 */
    path: number[];
    t: number;
    /** 출발까지 남은 틱 (M_WAIT) */
    wait: number;
    /** 급강하 경로 위에서 쏠 틱 (−1 = 안 쏨) */
    fire1: number;
    fire2: number;
    /** 대장 급강하 무리 번호 (0 = 무리 아님) */
    squad: number;
}

export interface Shot {
    x: number;
    y: number;
    py: number;
}

export interface Bullet {
    x: number;
    y: number;
    px: number;
    py: number;
    vx: number;
    vy: number;
}

export interface Item {
    kind: number;
    x: number;
    y: number;
    py: number;
}

/** 대장 + 호위 급강하 무리: 남은 수, 아직 모두 내 총에 떨어지고 있는가 */
export interface Squad {
    id: number;
    left: number;
    ok: boolean;
    escorts: number;
}

export interface GameLog {
    /** [틱, x, 틱, x, …] — 비행기 목표 x 가 바뀐 틱만 */
    moves: number[];
}

export type EndReason = '' | 'lives' | 'limit';

export interface Game {
    seed: number;
    /** 난수 상태 (uint32) */
    rng: number;
    tick: number;
    score: number;
    lives: number;
    /** 스테이지 번호(1부터) */
    stageNo: number;
    /** 깬 일반 스테이지 수 = 난이도 단계 */
    level: number;
    /** 지금이 보너스 스테이지인가 */
    bonus: boolean;
    bonusHits: number;
    bonusTotal: number;
    phase: number;
    phaseTimer: number;
    /** 비행기 가운데 x (단위) */
    shipX: number;
    shipPrevX: number;
    /** 다시 나올 때까지 남은 틱 (0 = 살아 있음) */
    dead: number;
    invuln: number;
    shield: boolean;
    rapidTicks: number;
    fireCd: number;
    shots: Shot[];
    enemies: Enemy[];
    bullets: Bullet[];
    items: Item[];
    squads: Squad[];
    /** 아직 입장 중(대기·경로)인 적 수 */
    entering: number;
    /** 다음 급강하까지 남은 틱 (−1 = 아직 시작 안 함) */
    diveTimer: number;
    nextId: number;
    /** 다음 목숨 +1 점수 번호 (EXTEND_AT) */
    nextExtend: number;
    kills: number;
    over: boolean;
    reason: EndReason;
    /** 마지막으로 기록한 비행기 목표 x */
    lastX: number;
    log: GameLog;
}

export interface StepInput {
    /** 비행기 목표 x (논리 px). 정수로 버리고 0~360 으로 자른다 */
    x: number;
}

/** 한 틱에 일어난 일 — 화면 효과·안내용 (규칙에는 영향 없음) */
export type StepEvent =
    | { type: 'kill'; x: number; y: number; kind: number; points: number; dive: boolean }
    | { type: 'damage'; x: number; y: number }
    | { type: 'squad'; x: number; y: number; bonus: number }
    | { type: 'hit' }
    | { type: 'shield' }
    | { type: 'respawn' }
    | { type: 'extend' }
    | { type: 'drop'; kind: number }
    | { type: 'catch'; kind: number }
    | { type: 'clear' }
    | { type: 'bonus-result'; hits: number; total: number; bonus: number }
    | { type: 'stage'; stageNo: number; bonus: boolean }
    | { type: 'over'; reason: EndReason };

/**
 * mulberry32 — 32비트 정수 연산만 쓰는 작은 난수기. [다음 상태, 값(uint32)] 을 돌려준다.
 */
export function mulberry32(state: number): [number, number] {
    const s = (state + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [s, (t ^ (t >>> 14)) >>> 0];
}

function nextRand(g: Game): number {
    const [s, u] = mulberry32(g.rng);
    g.rng = s;
    return u;
}

function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

/** 두 사각형(가운데·반폭·반높이)이 겹치는가 — 가장자리에 딱 닿은 것은 겹침이 아니다 */
export function overlaps(
    ax: number,
    ay: number,
    ahw: number,
    ahh: number,
    bx: number,
    by: number,
    bhw: number,
    bhh: number
): boolean {
    return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

/** 두 사각형(왼·위·오른·아래)이 겹치는가 — 가장자리에 딱 닿은 것은 겹침이 아니다 */
export function rectsOverlap(
    l1: number,
    t1: number,
    r1: number,
    b1: number,
    l2: number,
    t2: number,
    r2: number,
    b2: number
): boolean {
    return l1 < r2 && r1 > l2 && t1 < b2 && b1 > t2;
}

/** 적 맞는 상자 반폭(단위) */
export function enemyHalf(kind: number): number {
    return (kind === ENEMY_BOSS ? BOSS_HALF : ENEMY_HALF) * S;
}

/** 이 틱의 편대 흔들림(단위) — 세모파, −SWAY_PX ~ +SWAY_PX */
export function swayAt(tick: number): number {
    const half = SWAY_TICKS / 2;
    const p = tick % SWAY_TICKS;
    const tri = p < half ? p - half / 2 : half + half / 2 - p;
    return idiv(tri * SWAY_PX * S, half / 2);
}

/** 편대 칸의 지금 위치 [x, y] (단위) */
export function slotPos(slot: number, tick: number): [number, number] {
    const col = slot % FORM_COLS;
    const row = (slot - col) / FORM_COLS;
    return [(FORM_LEFT + col * FORM_DX) * S + swayAt(tick), (FORM_TOP + row * FORM_DY) * S];
}

/** 비행기가 살아 있는가 (맞고 다시 나오기 전이 아님) */
export function shipAlive(g: Game): boolean {
    return !g.over && g.dead === 0;
}

function newEnemy(g: Game, kind: number, slot: number, path: number[], wait: number): Enemy {
    const x = path[1];
    const y = path[2];
    return {
        id: g.nextId++,
        kind,
        hp: slot < 0 ? 1 : enemyHp(kind),
        slot,
        mode: M_WAIT,
        x,
        y,
        px: x,
        py: y,
        path,
        t: 0,
        wait,
        fire1: -1,
        fire2: -1,
        squad: 0
    };
}

/** g.stageNo 의 적을 깐다 (일반 = 편대 입장, 보너스 = 줄지어 지나가기) */
export function loadStage(g: Game): void {
    g.enemies = [];
    g.squads = [];
    g.phase = PH_PLAY;
    g.phaseTimer = 0;
    g.diveTimer = -1;
    g.bonus = isBonusStage(g.stageNo);
    g.bonusHits = 0;
    g.bonusTotal = 0;
    if (g.bonus) {
        const kinds = [ENEMY_GRUNT, ENEMY_MID, ENEMY_GRUNT, ENEMY_MID, ENEMY_BOSS];
        for (let w = 0; w < BONUS_WAVES; w++) {
            const path = toPath(BONUS_PATHS[w % BONUS_PATHS.length], S, FIELD_W, w % 2 === 1);
            for (let j = 0; j < BONUS_WAVE_SIZE; j++) {
                const wait = WAVE_START + w * BONUS_WAVE_GAP + j * BONUS_MEMBER_GAP;
                g.enemies.push(newEnemy(g, kinds[w % kinds.length], -1, path, wait));
            }
        }
        g.bonusTotal = g.enemies.length;
    } else {
        const layout = LAYOUTS[Math.min(g.level, LAYOUTS.length - 1)];
        // 무리: 0 = 맨 위 두 줄(대장·중간), 1~3 = 그 아래 한 줄씩. 왼쪽 반은 왼쪽에서, 오른쪽 반은 오른쪽에서
        const count = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let row = 0; row < layout.length; row++) {
            for (let col = 0; col < FORM_COLS; col++) {
                const kind = enemyKindOf(layout[row].charAt(col));
                if (kind === 0) continue;
                const wave = row <= 1 ? 0 : row - 1;
                const right = col >= FORM_COLS / 2;
                const table = ENTRY_PATHS[(wave + g.level) % ENTRY_PATHS.length];
                const path = toPath(table, S, FIELD_W, right);
                const j = count[wave * 2 + (right ? 1 : 0)]++;
                const wait = WAVE_START + wave * WAVE_GAP + j * MEMBER_GAP;
                g.enemies.push(newEnemy(g, kind, row * FORM_COLS + col, path, wait));
            }
        }
    }
    g.entering = g.enemies.length;
}

/** 새 판 — seed 는 uint32 */
export function createGame(seed: number): Game {
    const g: Game = {
        seed: seed >>> 0,
        rng: seed >>> 0,
        tick: 0,
        score: 0,
        lives: START_LIVES,
        stageNo: 1,
        level: 0,
        bonus: false,
        bonusHits: 0,
        bonusTotal: 0,
        phase: PH_PLAY,
        phaseTimer: 0,
        shipX: START_X * S,
        shipPrevX: START_X * S,
        dead: 0,
        invuln: 0,
        shield: false,
        rapidTicks: 0,
        fireCd: 0,
        shots: [],
        enemies: [],
        bullets: [],
        items: [],
        squads: [],
        entering: 0,
        diveTimer: -1,
        nextId: 1,
        nextExtend: 0,
        kills: 0,
        over: false,
        reason: '',
        lastX: START_X,
        log: { moves: [] }
    };
    loadStage(g);
    return g;
}

function end(g: Game, reason: EndReason, ev: StepEvent[]): void {
    g.over = true;
    g.reason = reason;
    ev.push({ type: 'over', reason });
}

/** 점수를 더하고 목숨 +1 점수를 넘었으면 목숨을 준다 */
export function addScore(g: Game, points: number, ev: StepEvent[]): void {
    g.score += points;
    while (g.nextExtend < EXTEND_AT.length && g.score >= EXTEND_AT[g.nextExtend]) {
        g.nextExtend++;
        if (g.lives < MAX_LIVES) g.lives++;
        ev.push({ type: 'extend' });
    }
}

function findSquad(g: Game, id: number): Squad | null {
    for (const q of g.squads) if (q.id === id) return q;
    return null;
}

/** 무리의 한 마리가 빠졌다 (shot = 내 총에 떨어짐). 무리가 모두 내 총에 떨어지면 추가 점수 */
function leaveSquad(g: Game, e: Enemy, shot: boolean, ev: StepEvent[]): void {
    if (e.squad === 0) return;
    const q = findSquad(g, e.squad);
    e.squad = 0;
    if (!q) return;
    if (!shot) q.ok = false;
    q.left--;
    if (q.left > 0) return;
    g.squads.splice(g.squads.indexOf(q), 1);
    if (q.ok && q.escorts > 0) {
        const bonus = SQUAD_BONUS[Math.min(q.escorts, SQUAD_BONUS.length - 1)];
        addScore(g, bonus, ev);
        ev.push({ type: 'squad', x: e.x, y: e.y, bonus });
    }
}

/** 적 하나를 떨어뜨린다 (shot = 내 총알로, 아니면 비행기와 부딪혀서) */
function killEnemy(g: Game, e: Enemy, shot: boolean, ev: StepEvent[]): void {
    e.hp = 0;
    g.kills++;
    const dive = e.mode === M_DIVE;
    let points: number;
    if (g.bonus) {
        points = BONUS_HIT_POINTS;
        g.bonusHits++;
    } else {
        points = (dive ? DIVE_POINTS : FORM_POINTS)[e.kind] ?? 0;
    }
    addScore(g, points, ev);
    ev.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, points, dive });
    leaveSquad(g, e, shot, ev);
    // 아이템 — 일반 스테이지에서 내 총에 떨어진 대장마다 난수 하나(떨어지면 종류용으로 하나 더)
    if (shot && !g.bonus && e.kind === ENEMY_BOSS && nextRand(g) % 100 < DROP_PERCENT) {
        const kind = itemKindFor(nextRand(g) % 100);
        g.items.push({ kind, x: e.x, y: e.y, py: e.y });
        ev.push({ type: 'drop', kind });
    }
}

/** 내 총알이 적을 맞혔다 */
function hitEnemy(g: Game, e: Enemy, ev: StepEvent[]): void {
    e.hp--;
    if (e.hp > 0) {
        ev.push({ type: 'damage', x: e.x, y: e.y });
        return;
    }
    killEnemy(g, e, true, ev);
}

/** 비행기가 맞았다 — 방패가 있으면 방패만 깨진다 */
function hitShip(g: Game, ev: StepEvent[]): void {
    if (g.shield) {
        g.shield = false;
        g.invuln = SHIELD_INVULN_TICKS;
        ev.push({ type: 'shield' });
        return;
    }
    g.lives--;
    g.rapidTicks = 0;
    ev.push({ type: 'hit' });
    if (g.lives <= 0) end(g, 'lives', ev);
    else g.dead = RESPAWN_TICKS;
}

/** 맞을 수 있는 상태인가 */
function vulnerable(g: Game): boolean {
    return shipAlive(g) && g.invuln === 0;
}

/** 적이 비행기 쪽으로 한 발 쏜다 (조건이 안 맞으면 쏘지 않는다) */
function enemyFire(g: Game, e: Enemy): void {
    if (!shipAlive(g) || g.bullets.length >= MAX_ENEMY_BULLETS) return;
    if (e.y > SHIP_YU - FIRE_MIN_GAP * S || e.y < 0) return;
    const vy = bulletSpeed(g.level);
    const frames = Math.max(1, idiv(SHIP_YU - e.y, vy));
    const lim = idiv(vy, 2);
    const vx = clamp(idiv(g.shipX - e.x, frames), -lim, lim);
    g.bullets.push({ x: e.x, y: e.y, px: e.x, py: e.y, vx, vy });
}

/** 적 하나를 급강하시킨다 */
function launch(g: Game, e: Enemy, path: number[]): void {
    e.mode = M_DIVE;
    e.path = path;
    e.t = 0;
    e.fire1 = -1;
    e.fire2 = -1;
    if (nextRand(g) % 100 < fireChance(g.level)) {
        e.fire1 = 40 + (nextRand(g) % 30);
        if (nextRand(g) % 100 < secondShotChance(g.level)) e.fire2 = e.fire1 + 18;
    }
}

/** 급강하 — 편대에서 한 마리(대장이면 호위까지) 골라 내려보낸다 */
export function startDive(g: Game): void {
    let busy = 0;
    let weight = 0;
    for (const e of g.enemies) {
        if (e.mode === M_DIVE || e.mode === M_HOME) busy++;
        else if (e.mode === M_FORM) weight += e.kind === ENEMY_MID ? 2 : 1;
    }
    const room = maxDivers(g.level) - busy;
    if (room <= 0 || weight === 0) return;
    // 가중 뽑기 — 중간은 두 배 자주 내려온다
    let r = nextRand(g) % weight;
    let pick: Enemy | null = null;
    for (const e of g.enemies) {
        if (e.mode !== M_FORM) continue;
        r -= e.kind === ENEMY_MID ? 2 : 1;
        if (r < 0) {
            pick = e;
            break;
        }
    }
    if (!pick) return;
    const col = pick.slot % FORM_COLS;
    const side = col < FORM_COLS / 2 ? -1 : 1;
    const spread = (nextRand(g) % (AIM_SPREAD * 2 + 1)) - AIM_SPREAD;
    const ax = clamp(g.shipX + spread * S, 20 * S, (FIELD_W - 20) * S);
    const path = divePath(pick.x, pick.y, side, ax, diveTicks(g.level), S, (FIELD_H + 40) * S);
    launch(g, pick, path);
    if (pick.kind !== ENEMY_BOSS || room < 2) return;
    // 호위 — 바로 아래 줄에서 가까운 칸 최대 둘
    const escorts: Enemy[] = [];
    for (const e of g.enemies) {
        if (escorts.length >= Math.min(2, room - 1)) break;
        if (e.mode !== M_FORM || e.slot < FORM_COLS || e.slot >= FORM_COLS * 2) continue;
        if (Math.abs((e.slot % FORM_COLS) - col) <= 1) escorts.push(e);
    }
    if (escorts.length === 0) return;
    const id = pick.id;
    pick.squad = id;
    for (let k = 0; k < escorts.length; k++) {
        const e = escorts[k];
        // 대장 경로를 편대에서의 자리 차이만큼 옮겨 따라간다 (출발점이 지금 자리라 튀지 않는다)
        launch(g, e, shiftPath(path, e.x - pick.x, e.y - pick.y));
        e.squad = id;
    }
    g.squads.push({ id, left: 1 + escorts.length, ok: true, escorts: escorts.length });
}

// 경로 위치 계산용(할당을 줄이려고 재사용)
const pt = [0, 0];

/** 적 하나를 이번 틱만큼 움직인다 */
function moveEnemy(g: Game, e: Enemy, ev: StepEvent[]): void {
    if (e.mode === M_WAIT) {
        if (--e.wait > 0) return;
        e.mode = e.slot < 0 ? M_FLY : M_ENTER;
        e.t = 0;
        return;
    }
    if (e.mode === M_FORM) {
        const [x, y] = slotPos(e.slot, g.tick);
        e.x = x;
        e.y = y;
        return;
    }
    if (e.mode === M_HOME) {
        const [tx, ty] = slotPos(e.slot, g.tick);
        const dx = tx - e.x;
        const dy = ty - e.y;
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        const v = HOME_SPEED * S;
        if (m <= v) {
            e.x = tx;
            e.y = ty;
            e.mode = M_FORM;
        } else {
            e.x += idiv(dx * v, m);
            e.y += idiv(dy * v, m);
        }
        return;
    }
    // 경로 따라가기 (입장·보너스·급강하)
    e.t++;
    pathPoint(e.path, e.t, pt);
    e.x = pt[0];
    e.y = pt[1];
    if (e.mode === M_DIVE && (e.t === e.fire1 || e.t === e.fire2)) enemyFire(g, e);
    if (e.t < pathTicks(e.path)) return;
    if (e.mode === M_ENTER) {
        e.mode = M_HOME;
    } else if (e.mode === M_FLY) {
        e.hp = 0; // 보너스 적이 빠져나갔다
    } else {
        // 급강하가 끝나 판 아래로 빠졌다 — 위에서 다시 나와 제자리로 돌아간다
        leaveSquad(g, e, false, ev);
        const [sx] = slotPos(e.slot, g.tick);
        e.mode = M_HOME;
        e.x = sx;
        e.y = -16 * S;
        e.px = e.x;
        e.py = e.y;
    }
}

/** 남은(hp > 0) 적만 남긴다 (떨어졌거나 빠져나간 적은 hp = 0) */
function sweepEnemies(g: Game): void {
    let w = 0;
    for (let k = 0; k < g.enemies.length; k++) {
        const e = g.enemies[k];
        if (e.hp > 0) g.enemies[w++] = e;
    }
    g.enemies.length = w;
}

/** 내 총알을 움직이고 적과 충돌시킨다 */
function moveShots(g: Game, ev: StepEvent[]): void {
    let w = 0;
    for (let k = 0; k < g.shots.length; k++) {
        const s = g.shots[k];
        const oy = s.y;
        s.y -= SHOT_SPEED * S;
        // 지나온 길 전체: 위 = 지금 위치 위끝, 아래 = 직전 위치 아래끝
        const l = s.x - SHOT_HW * S;
        const r = s.x + SHOT_HW * S;
        const top = s.y - SHOT_HH * S;
        const bottom = oy + SHOT_HH * S;
        let target: Enemy | null = null;
        for (const e of g.enemies) {
            if (e.hp <= 0 || e.mode === M_WAIT) continue;
            const h = enemyHalf(e.kind);
            if (!rectsOverlap(l, top, r, bottom, e.x - h, e.y - h, e.x + h, e.y + h)) continue;
            // 총알이 위로 가므로 가장 아래(먼저 만나는) 적을 맞힌다
            if (!target || e.y > target.y) target = e;
        }
        if (target) {
            hitEnemy(g, target, ev);
            continue;
        }
        if (s.y + SHOT_HH * S < 0) continue;
        g.shots[w++] = s;
    }
    g.shots.length = w;
}

/** 적 총알을 움직이고 비행기와 충돌시킨다 */
function moveBullets(g: Game, ev: StepEvent[]): void {
    let w = 0;
    const hit = SHIP_HIT * S;
    for (let k = 0; k < g.bullets.length; k++) {
        const b = g.bullets[k];
        const ox = b.x;
        const oy = b.y;
        b.x += b.vx;
        b.y += b.vy;
        if (vulnerable(g)) {
            // 지나온 길 전체를 덮는 사각형
            const l = Math.min(ox, b.x) - EBULLET_HW * S;
            const r = Math.max(ox, b.x) + EBULLET_HW * S;
            const t = Math.min(oy, b.y) - EBULLET_HH * S;
            const bt = Math.max(oy, b.y) + EBULLET_HH * S;
            const sx = g.shipX;
            if (rectsOverlap(l, t, r, bt, sx - hit, SHIP_YU - hit, sx + hit, SHIP_YU + hit)) {
                hitShip(g, ev);
                continue;
            }
        }
        if (b.y - EBULLET_HH * S > FH || b.x < -8 * S || b.x > FW + 8 * S) continue;
        g.bullets[w++] = b;
    }
    g.bullets.length = w;
}

/** 내려온 적과 비행기가 부딪혔는가 */
function collideShip(g: Game, ev: StepEvent[]): void {
    if (!vulnerable(g)) return;
    const hit = SHIP_HIT * S;
    for (const e of g.enemies) {
        if (e.hp <= 0 || (e.mode !== M_DIVE && e.mode !== M_ENTER && e.mode !== M_HOME)) continue;
        const h = enemyHalf(e.kind) - 2 * S;
        if (!overlaps(e.x, e.y, h, h, g.shipX, SHIP_YU, hit, hit)) continue;
        killEnemy(g, e, false, ev);
        hitShip(g, ev);
        return;
    }
}

function updateItems(g: Game, ev: StepEvent[]): void {
    const reach = (ITEM_HALF + SHIP_HALF_W) * S;
    let w = 0;
    for (let k = 0; k < g.items.length; k++) {
        const it = g.items[k];
        it.y += ITEM_FALL;
        if (shipAlive(g) && overlaps(it.x, it.y, reach, reach, g.shipX, SHIP_YU, 0, 0)) {
            if (it.kind === ITEM_RAPID) g.rapidTicks = RAPID_TICKS;
            else if (it.kind === ITEM_SHIELD) g.shield = true;
            addScore(g, ITEM_POINTS, ev);
            ev.push({ type: 'catch', kind: it.kind });
            continue;
        }
        if (it.y - ITEM_HALF * S > FH) continue;
        g.items[w++] = it;
    }
    g.items.length = w;
}

/** 자동 사격 */
function fire(g: Game): void {
    if (g.fireCd > 0) g.fireCd--;
    if (!shipAlive(g) || g.fireCd > 0) return;
    const rapid = g.rapidTicks > 0;
    if (g.shots.length >= (rapid ? RAPID_SHOTS : MAX_SHOTS)) return;
    const y = SHIP_YU - 14 * S;
    g.shots.push({ x: g.shipX, y, py: y });
    g.fireCd = rapid ? RAPID_FIRE_TICKS : FIRE_TICKS;
}

/** 스테이지 진행 — 급강하 순서, 클리어, 다음 스테이지 */
function progress(g: Game, ev: StepEvent[]): void {
    if (g.phase === PH_CLEAR) {
        if (--g.phaseTimer > 0) return;
        if (!g.bonus) g.level++;
        g.stageNo++;
        loadStage(g);
        ev.push({ type: 'stage', stageNo: g.stageNo, bonus: g.bonus });
        return;
    }
    if (g.enemies.length === 0) {
        if (g.bonus) {
            const hits = g.bonusHits;
            const bonus = hits === g.bonusTotal ? BONUS_PERFECT : hits * BONUS_HIT_POINTS;
            addScore(g, bonus, ev);
            ev.push({ type: 'bonus-result', hits, total: g.bonusTotal, bonus });
        } else {
            ev.push({ type: 'clear' });
        }
        g.phase = PH_CLEAR;
        g.phaseTimer = STAGE_GAP_TICKS;
        return;
    }
    if (g.bonus || g.entering > 0 || !shipAlive(g)) return;
    if (g.diveTimer < 0) g.diveTimer = FIRST_DIVE_TICKS;
    if (--g.diveTimer > 0) return;
    startDive(g);
    g.diveTimer = diveInterval(g.level);
}

/** 한 틱 진행. 끝난 판이면 아무것도 하지 않는다 */
export function step(g: Game, input: StepInput): StepEvent[] {
    const ev: StepEvent[] = [];
    if (g.over) return ev;

    // 1) 비행기 — 목표 x 쪽으로 한 틱 최대 SHIP_SPEED
    const x = clamp(Math.trunc(Number(input.x) || 0), 0, FIELD_W);
    if (x !== g.lastX) {
        g.log.moves.push(g.tick, x);
        g.lastX = x;
    }
    g.shipPrevX = g.shipX;
    const target = clamp(x * S, SHIP_HALF_W * S, FW - SHIP_HALF_W * S);
    g.shipX += clamp(target - g.shipX, -SHIP_SPEED * S, SHIP_SPEED * S);

    for (const s of g.shots) s.py = s.y;
    for (const e of g.enemies) {
        e.px = e.x;
        e.py = e.y;
    }
    for (const b of g.bullets) {
        b.px = b.x;
        b.py = b.y;
    }
    for (const it of g.items) it.py = it.y;

    // 2) 타이머
    if (g.rapidTicks > 0) g.rapidTicks--;
    if (g.invuln > 0) g.invuln--;
    if (g.dead > 0 && --g.dead === 0) {
        g.invuln = INVULN_TICKS;
        ev.push({ type: 'respawn' });
    }

    // 3) 적
    let entering = 0;
    for (const e of g.enemies) {
        moveEnemy(g, e, ev);
        if (e.mode === M_WAIT || e.mode === M_ENTER) entering++;
    }
    g.entering = entering;

    // 4) 내 총알 (움직이고 맞힌 뒤 새로 쏜다)
    moveShots(g, ev);
    fire(g);

    // 5) 적 총알·몸통 박치기
    moveBullets(g, ev);
    if (!g.over) collideShip(g, ev);
    sweepEnemies(g);

    // 6) 아이템
    updateItems(g, ev);

    // 7) 진행
    if (!g.over) progress(g, ev);

    g.tick++;
    if (!g.over && g.tick >= MAX_TICKS) end(g, 'limit', ev);
    return ev;
}

/** 재연 거부 이유 */
export type ReplayError =
    | ''
    /** 기록 모양이 틀림(배열 아님·정수 아님·moves 길이 홀수) */
    | 'bad-log'
    /** 판 길이가 0~MAX_TICKS 정수가 아님 */
    | 'bad-ticks'
    /** 틱이 커지는 순서가 아니거나 같은 틱이 두 번 */
    | 'tick-order'
    /** 비행기 x 가 0~360 밖 */
    | 'x-range'
    /** 바로 앞 값과 같은 x (엔진은 바뀐 틱만 남긴다) */
    | 'x-unchanged'
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

function isTickList(v: unknown): v is number[] {
    return Array.isArray(v) && v.every((n) => Number.isSafeInteger(n));
}

/** 기록 모양만 본다 (판을 돌리지 않고 알 수 있는 것) */
function checkLog(log: GameLog, ticks: number): ReplayError {
    if (!log || !isTickList(log.moves) || log.moves.length % 2 !== 0) return 'bad-log';
    if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > MAX_TICKS) return 'bad-ticks';
    let prevTick = -1;
    let prevX = START_X;
    for (let k = 0; k < log.moves.length; k += 2) {
        const t = log.moves[k];
        const x = log.moves[k + 1];
        if (t <= prevTick) return 'tick-order';
        if (t >= ticks) return 'tick-range';
        if (x < 0 || x > FIELD_W) return 'x-range';
        if (x === prevX) return 'x-unchanged';
        prevTick = t;
        prevX = x;
    }
    return '';
}

/**
 * 입력 기록으로 판을 처음부터 다시 돌린다 — 판 길이 ticks 까지.
 * 기록이 엔진이 남기는 모양과 다르면(순서·범위·중복·길이) 조용히 넘기지 않고
 * ok=false 와 이유를 돌려준다.
 */
export function replay(seed: number, log: GameLog, ticks: number): ReplayResult {
    const g = createGame(seed);
    const bad = checkLog(log, ticks);
    if (bad) return { ok: false, error: bad, game: g };
    let x = START_X;
    let mi = 0;
    for (let t = 0; t < ticks; t++) {
        if (g.over) return { ok: false, error: 'length', game: g };
        if (mi < log.moves.length && log.moves[mi] === t) {
            x = log.moves[mi + 1];
            mi += 2;
        }
        step(g, { x });
    }
    return { ok: true, error: '', game: g };
}

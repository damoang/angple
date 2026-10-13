/**
 * 벽돌깨기 규칙 — DOM 없음, 결정적(deterministic).
 *
 * 같은 seed 와 같은 입력 기록을 넣으면 어느 기기에서 돌려도 같은 판·같은 점수가 나온다.
 * (2단계에서 서버가 같은 규칙으로 끝난 판을 다시 돌려 점수를 확인할 수 있게 하려는 것.)
 *
 * 결정성을 위한 약속
 * - 고정 틱 60회/초. 한 번의 step() = 한 틱. 시간(Date·performance)을 읽지 않는다.
 * - 좌표·속도는 모두 정수(고정소수점: 논리 1px = SCALE 단위). 부동소수점 계산 결과를 상태에 넣지 않는다.
 *   나눗셈은 idiv(0 쪽으로 버림) 하나만 쓴다 — Go 의 정수 나눗셈과 같다.
 * - 각도는 미리 정한 정수 표(SIN·COS × 4096)에서만 고른다.
 * - 난수는 seed 에서 시작하는 mulberry32 하나뿐이고, 깨진 벽돌의 아이템 판정에만 쓴다.
 *
 * 판(논리 좌표)
 * - 가로 360 × 세로 540. 벽돌 칸 34×16, 한 줄 10칸, 왼쪽 위 (10, 56) 부터.
 * - 막대 윗변 y=500, 두께 10, 폭 64(넓게 아이템 96). 공 반지름 5.
 *
 * 충돌
 * - 공은 한 틱에 최대 약 10px 를 간다. 이것을 3px 이하의 작은 걸음으로 나눠 걸음마다 벽·막대·벽돌을
 *   검사한다(벽돌 두께 16 + 공 지름 10 보다 훨씬 작으므로 빠른 공도 벽돌을 뚫고 지나가지 못한다).
 * - 벽돌에 닿으면 그 걸음을 되돌리고, 직전 위치가 벽돌의 어느 쪽이었는지로 튕길 방향을 정한다
 *   (위·아래 면 = 세로 반전, 옆면 = 가로 반전, 모서리 = 벽돌 쪽으로 향하던 성분만 반전).
 *   한 걸음에 면과 모서리가 같이 닿으면(벽돌 두 개의 이음매) 면만 친다. 같은 줄의 면 두 개에 닿으면
 *   직전 중심을 안쪽에 품은 벽돌 하나만(정확히 경계 위면 번호가 작은 벽돌) 친다.
 * - 막대: 맞은 자리가 가운데에서 멀수록 비스듬히(5°~60°) 튕긴다. 정확히 수직(0°)은 없다.
 *
 * 입력 기록(GameLog) — 2단계 서버 재연용, 아직 어디에도 보내지 않는다.
 * - moves: [틱, x, 틱, x, …] 막대 목표 x(논리 px 정수 0~360)가 「바뀐 틱만」. 처음 값은 180.
 * - launches: [틱, …] 공을 실제로 쏜 틱.
 * - 판 길이는 game.tick. replay(seed, log, tick) 으로 같은 판을 다시 만든다(어긋난 기록은 거부).
 */
import {
    BRICK_NONE,
    BRICK_SOLID,
    BREAK_POINTS,
    DAMAGE_POINTS,
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
    brickKindOf,
    hitPoints,
    isBreakable,
    itemKindFor
} from './stages';

/** 논리 1px 의 고정소수점 단위 */
export const SCALE = 256;
/** 1초 틱 수 */
export const TICK_HZ = 60;

export const FIELD_W = 360;
export const FIELD_H = 540;

export const BRICK_COLS = 10;
export const BRICK_ROWS = 10;
export const BRICK_W = 34;
export const BRICK_H = 16;
export const BRICK_LEFT = 10;
export const BRICK_TOP = 56;

/** 막대 윗변 y */
export const PADDLE_Y = 500;
export const PADDLE_H = 10;
export const PADDLE_W = 64;
export const PADDLE_WIDE_W = 96;
/** 입력이 없을 때의 막대 x (= 입력 기록의 시작 값) */
export const START_X = FIELD_W / 2;

export const BALL_R = 5;

/** 아이템 상자 크기와 떨어지는 속도(단위/틱) */
export const ITEM_W = 24;
export const ITEM_H = 12;
export const ITEM_FALL = 2 * SCALE;

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const MAX_BALLS = 8;
/** 넓게·느리게 지속 시간(틱) */
export const WIDE_TICKS = 15 * TICK_HZ;
export const SLOW_TICKS = 10 * TICK_HZ;

/** 공 속력(단위/틱): 기본 + 스테이지마다 + 바퀴마다, 상한 있음. 느리게 = ×2/3 */
export const BASE_SPEED = 1152;
export const STAGE_SPEED_STEP = 48;
export const LOOP_SPEED_STEP = 256;
export const MAX_SPEED = 2560;
/** 한 걸음 최대 이동(단위) — 터널링 방지 */
export const MAX_SUBSTEP = 3 * SCALE;
/** 공이 이 틱 동안 막대·깨지는 벽돌에 안 닿으면 각도를 한 칸 바꾼다(안 깨지는 벽돌 사이 무한 반복 방지) */
export const IDLE_NUDGE_TICKS = 15 * TICK_HZ;
/** 판 하나의 최대 틱(1시간) — 넘으면 판이 끝난다 */
export const MAX_TICKS = 60 * 60 * TICK_HZ;

/** 각도 표: 수직에서 5° 간격 0~60°, × 4096 */
export const TRIG_ONE = 4096;
export const SIN = [0, 357, 711, 1060, 1401, 1731, 2048, 2349, 2633, 2896, 3138, 3355, 3547];
export const COS = [4096, 4080, 4034, 3956, 3849, 3712, 3547, 3355, 3138, 2896, 2633, 2349, 2048];
export const MAX_ANGLE = 12;
/** 발사 각도(15°) */
export const LAUNCH_ANGLE = 3;

const S = SCALE;
const R = BALL_R * S;
const R2 = R * R;
const FW = FIELD_W * S;
const FH = FIELD_H * S;
const P_TOP = PADDLE_Y * S;
const P_BOTTOM = (PADDLE_Y + PADDLE_H) * S;
const B_LEFT = BRICK_LEFT * S;
const B_TOP = BRICK_TOP * S;
const BW = BRICK_W * S;
const BH = BRICK_H * S;
const ATTACH_Y = P_TOP - R;

export interface Ball {
    /** 그리기용 구분 번호(보간할 때 이전 틱 위치와 짝짓는다) */
    id: number;
    x: number;
    y: number;
    /** 직전 틱 끝 위치(그리기 보간용) */
    px: number;
    py: number;
    /** 각도 표 번호 1~12 (수직에서 5°×a) */
    a: number;
    /** 가로·세로 방향 부호(±1) */
    sx: number;
    sy: number;
    /** 막대·깨지는 벽돌에 안 닿은 틱 수 */
    idle: number;
}

export interface Item {
    kind: number;
    x: number;
    y: number;
    /** 직전 틱 y (그리기 보간용) */
    py: number;
}

export interface GameLog {
    /** [틱, x, 틱, x, …] — 막대 목표 x 가 바뀐 틱만 */
    moves: number[];
    /** 공을 쏜 틱 */
    launches: number[];
}

export type EndReason = '' | 'lives' | 'limit';

export interface Game {
    seed: number;
    /** 난수 상태 (uint32) */
    rng: number;
    tick: number;
    score: number;
    lives: number;
    /** 0~4 */
    stage: number;
    /** 다섯 스테이지를 다 돈 횟수 */
    loop: number;
    stagesCleared: number;
    /** 벽돌 종류·남은 내구도 — 칸 번호 = 줄 × BRICK_COLS + 칸 */
    kinds: number[];
    hp: number[];
    /** 남은 깨지는 벽돌 수 (0 이면 클리어) */
    remaining: number;
    /** 막대 가운데 x (단위) */
    paddleX: number;
    paddlePrevX: number;
    /** 막대 반폭 (단위) */
    paddleHalf: number;
    wideTicks: number;
    slowTicks: number;
    balls: Ball[];
    nextBallId: number;
    /** 공이 막대 위에 붙어 발사를 기다리는 중 */
    attached: boolean;
    items: Item[];
    combo: number;
    maxCombo: number;
    bricksBroken: number;
    over: boolean;
    reason: EndReason;
    /** 마지막으로 기록한 막대 목표 x */
    lastX: number;
    log: GameLog;
}

export interface StepInput {
    /** 막대 목표 x (논리 px). 정수로 버리고 0~360 으로 자른다 */
    x: number;
    /** 공이 붙어 있으면 쏜다 */
    launch?: boolean;
}

/** 한 틱에 일어난 일 — 화면 효과·안내용 (규칙에는 영향 없음) */
export type StepEvent =
    | { type: 'brick'; col: number; row: number; kind: number; broken: boolean; points: number }
    | { type: 'solid'; col: number; row: number }
    | { type: 'paddle' }
    | { type: 'wall' }
    | { type: 'launch' }
    | { type: 'drop'; kind: number }
    | { type: 'catch'; kind: number }
    | { type: 'ball-lost' }
    | { type: 'life-lost' }
    | { type: 'clear'; bonus: number }
    | { type: 'over'; reason: EndReason };

/** 정수 나눗셈 — 0 쪽으로 버림(Go 의 a / b 와 같다) */
export function idiv(a: number, b: number): number {
    return Math.trunc(a / b);
}

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

/** 스테이지·바퀴에 따른 공 속력(단위/틱), 느리게 아이템 반영 */
export function ballSpeed(g: Game): number {
    let s = BASE_SPEED + g.stage * STAGE_SPEED_STEP + g.loop * LOOP_SPEED_STEP;
    if (s > MAX_SPEED) s = MAX_SPEED;
    if (g.slowTicks > 0) s = idiv(s * 2, 3);
    return s;
}

/** 공의 이번 틱 속도 [vx, vy] (단위/틱) */
export function ballVelocity(g: Game, b: Ball): [number, number] {
    const s = ballSpeed(g);
    return [b.sx * idiv(s * SIN[b.a], TRIG_ONE), b.sy * idiv(s * COS[b.a], TRIG_ONE)];
}

function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

function clampPaddle(g: Game, x: number): number {
    return clamp(x, g.paddleHalf, FW - g.paddleHalf);
}

/** g.stage 의 배치를 판에 깐다 (남은 벽돌 수도 다시 센다) */
export function loadStage(g: Game): void {
    const rows = STAGES[g.stage];
    g.remaining = 0;
    for (let r = 0; r < BRICK_ROWS; r++) {
        const line = rows[r] ?? '';
        for (let c = 0; c < BRICK_COLS; c++) {
            const kind = brickKindOf(line.charAt(c));
            const i = r * BRICK_COLS + c;
            g.kinds[i] = kind;
            g.hp[i] = brickHp(kind);
            if (isBreakable(kind)) g.remaining++;
        }
    }
}

/** 공 하나를 막대 위에 붙이고 아이템·효과를 지운다 (새 스테이지·목숨을 잃은 뒤) */
function resetBall(g: Game): void {
    g.items = [];
    g.wideTicks = 0;
    g.slowTicks = 0;
    g.paddleHalf = (PADDLE_W * S) / 2;
    g.paddleX = clampPaddle(g, g.paddleX);
    g.combo = 0;
    g.attached = true;
    g.balls = [
        {
            id: g.nextBallId++,
            x: g.paddleX,
            y: ATTACH_Y,
            px: g.paddleX,
            py: ATTACH_Y,
            a: LAUNCH_ANGLE,
            sx: 1,
            sy: -1,
            idle: 0
        }
    ];
}

/** 새 판 — seed 는 uint32 */
export function createGame(seed: number): Game {
    const g: Game = {
        seed: seed >>> 0,
        rng: seed >>> 0,
        tick: 0,
        score: 0,
        lives: START_LIVES,
        stage: 0,
        loop: 0,
        stagesCleared: 0,
        kinds: new Array<number>(BRICK_COLS * BRICK_ROWS).fill(0),
        hp: new Array<number>(BRICK_COLS * BRICK_ROWS).fill(0),
        remaining: 0,
        paddleX: START_X * S,
        paddlePrevX: START_X * S,
        paddleHalf: (PADDLE_W * S) / 2,
        wideTicks: 0,
        slowTicks: 0,
        balls: [],
        nextBallId: 1,
        attached: true,
        items: [],
        combo: 0,
        maxCombo: 0,
        bricksBroken: 0,
        over: false,
        reason: '',
        lastX: START_X,
        log: { moves: [], launches: [] }
    };
    loadStage(g);
    resetBall(g);
    return g;
}

/** 칸 번호의 벽돌 사각형 [왼, 위, 오른, 아래] (단위) */
export function brickRect(col: number, row: number): [number, number, number, number] {
    const l = B_LEFT + col * BW;
    const t = B_TOP + row * BH;
    return [l, t, l + BW, t + BH];
}

/** 원(공)과 사각형이 겹치는가 — 가장자리에 딱 닿은 것은 겹침이 아니다 */
export function circleHitsRect(
    x: number,
    y: number,
    l: number,
    t: number,
    r: number,
    b: number
): boolean {
    const dx = x - clamp(x, l, r);
    const dy = y - clamp(y, t, b);
    return dx * dx + dy * dy < R2;
}

/** 벽돌 점수를 더한다 (콤보 반영 후 콤보 +1) */
function scoreHit(g: Game, base: number): number {
    const p = hitPoints(base, g.combo, g.loop);
    g.score += p;
    g.combo++;
    if (g.combo > g.maxCombo) g.maxCombo = g.combo;
    return p;
}

/** 벽돌 한 칸을 맞힌다 */
function hitBrick(g: Game, i: number, ev: StepEvent[]): boolean {
    const kind = g.kinds[i];
    const col = i % BRICK_COLS;
    const row = (i - col) / BRICK_COLS;
    if (kind === BRICK_SOLID) {
        ev.push({ type: 'solid', col, row });
        return false;
    }
    g.hp[i]--;
    if (g.hp[i] > 0) {
        ev.push({
            type: 'brick',
            col,
            row,
            kind,
            broken: false,
            points: scoreHit(g, DAMAGE_POINTS)
        });
        return true;
    }
    g.kinds[i] = BRICK_NONE;
    g.remaining--;
    g.bricksBroken++;
    ev.push({
        type: 'brick',
        col,
        row,
        kind,
        broken: true,
        points: scoreHit(g, BREAK_POINTS[kind])
    });
    // 아이템 — 깨진 벽돌마다 난수 하나(떨어지면 종류용으로 하나 더)
    if (nextRand(g) % 100 < DROP_PERCENT) {
        const itemKind = itemKindFor(nextRand(g) % 100);
        const [l, t] = brickRect(col, row);
        g.items.push({ kind: itemKind, x: l + BW / 2, y: t + BH / 2, py: t + BH / 2 });
        ev.push({ type: 'drop', kind: itemKind });
    }
    return true;
}

// 한 걸음에 닿은 벽돌 모음(할당을 줄이려고 재사용)
const hitIdx: number[] = [];
const hitFace: number[] = [];
const FACE_Y = 1;
const FACE_X = 2;
const CORNER = 3;

/** 면 충돌 k 에서 직전 중심이 벽돌 안쪽(경계 제외)에 있는가 — 가로 면은 x, 세로 면은 y 로 본다 */
function centerInside(k: number, ox: number, oy: number): boolean {
    const i = hitIdx[k];
    const col = i % BRICK_COLS;
    const [l, t, rt, bt] = brickRect(col, (i - col) / BRICK_COLS);
    return hitFace[k] === FACE_Y ? ox > l && ox < rt : oy > t && oy < bt;
}

/**
 * 이음매 — 같은 줄의 위·아래 면(또는 같은 칸의 옆면)에 둘 이상 닿았으면 하나만 친다.
 * 직전 중심을 안쪽에 품은 벽돌이 이기고, 둘 다(정확히 경계 위) 같으면 번호가 작은 벽돌이 이긴다.
 * k 가 진 쪽이면 true.
 */
function losesSeam(k: number, ox: number, oy: number): boolean {
    const face = hitFace[k];
    const i = hitIdx[k];
    const line = face === FACE_Y ? (i - (i % BRICK_COLS)) / BRICK_COLS : i % BRICK_COLS;
    const mine = centerInside(k, ox, oy);
    for (let j = 0; j < hitIdx.length; j++) {
        if (j === k || hitFace[j] !== face) continue;
        const o = hitIdx[j];
        const other = face === FACE_Y ? (o - (o % BRICK_COLS)) / BRICK_COLS : o % BRICK_COLS;
        if (other !== line) continue;
        const theirs = centerInside(j, ox, oy);
        if ((theirs && !mine) || (theirs === mine && o < i)) return true;
    }
    return false;
}

/**
 * 벽돌 충돌 — 공이 (ox,oy) 에서 지금 위치로 한 걸음 왔다. 닿은 벽돌이 있으면 방향을 바꾸고
 * 벽돌을 맞힌 뒤 true (부르는 쪽이 걸음을 되돌린다).
 */
function collideBricks(g: Game, b: Ball, ox: number, oy: number, ev: StepEvent[]): boolean {
    const x0 = b.x - R - B_LEFT;
    const x1 = b.x + R - B_LEFT;
    const y0 = b.y - R - B_TOP;
    const y1 = b.y + R - B_TOP;
    if (x1 < 0 || y1 < 0) return false;
    const c0 = x0 < 0 ? 0 : idiv(x0, BW);
    const r0 = y0 < 0 ? 0 : idiv(y0, BH);
    if (c0 >= BRICK_COLS || r0 >= BRICK_ROWS) return false;
    const c1 = Math.min(BRICK_COLS - 1, idiv(x1, BW));
    const r1 = Math.min(BRICK_ROWS - 1, idiv(y1, BH));

    hitIdx.length = 0;
    hitFace.length = 0;
    let anyFace = false;
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const i = r * BRICK_COLS + c;
            if (g.kinds[i] === BRICK_NONE) continue;
            const [l, t, rt, bt] = brickRect(c, r);
            if (!circleHitsRect(b.x, b.y, l, t, rt, bt)) continue;
            const inX = ox >= l && ox <= rt;
            const inY = oy >= t && oy <= bt;
            const face = inX && !inY ? FACE_Y : inY && !inX ? FACE_X : inX ? FACE_Y : CORNER;
            if (face !== CORNER) anyFace = true;
            hitIdx.push(i);
            hitFace.push(face);
        }
    }
    if (hitIdx.length === 0) return false;

    let flipX = 0;
    let flipY = 0;
    for (let k = 0; k < hitIdx.length; k++) {
        const face = hitFace[k];
        if (anyFace && face === CORNER) continue;
        if (face !== CORNER && losesSeam(k, ox, oy)) continue;
        const i = hitIdx[k];
        const col = i % BRICK_COLS;
        const [l, t, rt, bt] = brickRect(col, (i - col) / BRICK_COLS);
        if (face === FACE_Y) {
            flipY = oy < t ? -1 : oy > bt ? 1 : -b.sy;
        } else if (face === FACE_X) {
            flipX = ox < l ? -1 : 1;
        } else {
            // 모서리: 벽돌 쪽으로 향하던 성분만 반전한다. 둘 다 향하고 있었으면 모서리까지
            // 가로·세로 거리 중 큰 쪽(=더 옆에서 온 쪽), 같으면 둘 다.
            // 「향하던 성분만」이라 다시 닿아도 매번 하나씩 바깥쪽으로 돌아서 끼이지 않는다.
            const towardX = ox < l ? b.sx > 0 : b.sx < 0;
            const towardY = oy < t ? b.sy > 0 : b.sy < 0;
            let fx = towardX;
            let fy = towardY;
            if (towardX && towardY) {
                const ax = Math.abs(b.x - (ox < l ? l : rt));
                const ay = Math.abs(b.y - (oy < t ? t : bt));
                fx = ax >= ay;
                fy = ay >= ax;
            }
            if (fx) flipX = ox < l ? -1 : 1;
            if (fy) flipY = oy < t ? -1 : 1;
        }
        if (hitBrick(g, i, ev)) b.idle = 0;
    }
    if (flipX !== 0) b.sx = flipX;
    if (flipY !== 0) b.sy = flipY;
    return true;
}

/** 막대에 맞은 공을 맞은 자리에 따라 튕긴다 */
function bouncePaddle(g: Game, b: Ball): void {
    const off = b.x - g.paddleX;
    const lim = g.paddleHalf + R;
    const a = 1 + idiv(Math.abs(off) * MAX_ANGLE, lim);
    b.a = a > MAX_ANGLE ? MAX_ANGLE : a;
    if (off > 0) b.sx = 1;
    else if (off < 0) b.sx = -1;
    b.sy = -1;
    b.y = P_TOP - R;
    b.idle = 0;
    g.combo = 0;
}

/** 공 하나를 이번 틱만큼 움직인다. 바닥으로 빠지면 false */
function moveBall(g: Game, b: Ball, speed: number, ev: StepEvent[]): boolean {
    const n = idiv(speed + MAX_SUBSTEP - 1, MAX_SUBSTEP);
    for (let k = 0; k < n; k++) {
        const ox = b.x;
        const oy = b.y;
        b.x += b.sx * idiv(speed * SIN[b.a], TRIG_ONE * n);
        b.y += b.sy * idiv(speed * COS[b.a], TRIG_ONE * n);
        // 벽
        if (b.x < R) {
            b.x = R;
            b.sx = 1;
            ev.push({ type: 'wall' });
        } else if (b.x > FW - R) {
            b.x = FW - R;
            b.sx = -1;
            ev.push({ type: 'wall' });
        }
        if (b.y < R) {
            b.y = R;
            b.sy = 1;
            ev.push({ type: 'wall' });
        }
        // 막대 — 위에서 내려오다 윗면에 닿은 경우만 (옆을 스친 공은 그대로 떨어진다)
        if (
            b.sy > 0 &&
            oy < P_TOP &&
            circleHitsRect(
                b.x,
                b.y,
                g.paddleX - g.paddleHalf,
                P_TOP,
                g.paddleX + g.paddleHalf,
                P_BOTTOM
            )
        ) {
            bouncePaddle(g, b);
            ev.push({ type: 'paddle' });
            continue;
        }
        if (collideBricks(g, b, ox, oy, ev)) {
            b.x = ox;
            b.y = oy;
        }
        if (b.y - R > FH) return false;
    }
    if (++b.idle >= IDLE_NUDGE_TICKS) {
        b.a = (b.a % MAX_ANGLE) + 1;
        b.idle = 0;
    }
    return true;
}

/** 아이템 효과를 적용한다 */
export function applyItem(g: Game, kind: number): void {
    g.score += ITEM_POINTS;
    if (kind === ITEM_WIDE) {
        g.paddleHalf = (PADDLE_WIDE_W * S) / 2;
        g.wideTicks = WIDE_TICKS;
        g.paddleX = clampPaddle(g, g.paddleX);
    } else if (kind === ITEM_MULTI) {
        if (g.attached || g.balls.length === 0) return;
        const src = g.balls[0];
        // 원래 공에서 각도를 벌려 두 개를 더 낸다 (하나는 반대쪽으로)
        const spread = [src.a <= 6 ? src.a + 4 : src.a - 4, src.a <= 6 ? src.a + 2 : src.a - 2];
        for (let k = 0; k < spread.length && g.balls.length < MAX_BALLS; k++) {
            g.balls.push({
                id: g.nextBallId++,
                x: src.x,
                y: src.y,
                px: src.px,
                py: src.py,
                a: spread[k],
                sx: k === 0 ? -src.sx : src.sx,
                sy: src.sy,
                idle: 0
            });
        }
    } else if (kind === ITEM_SLOW) {
        g.slowTicks = SLOW_TICKS;
    } else if (kind === ITEM_LIFE) {
        if (g.lives < MAX_LIVES) g.lives++;
        else g.score += FULL_LIFE_POINTS;
    }
}

function updateItems(g: Game, ev: StepEvent[]): void {
    const hw = (ITEM_W * S) / 2;
    const hh = (ITEM_H * S) / 2;
    let w = 0;
    for (let k = 0; k < g.items.length; k++) {
        const it = g.items[k];
        it.y += ITEM_FALL;
        const caught =
            Math.abs(it.x - g.paddleX) < g.paddleHalf + hw &&
            it.y + hh >= P_TOP &&
            it.y - hh <= P_BOTTOM;
        if (caught) {
            ev.push({ type: 'catch', kind: it.kind });
            applyItem(g, it.kind);
            continue;
        }
        if (it.y - hh > FH) continue;
        g.items[w++] = it;
    }
    g.items.length = w;
}

/** 깨지는 벽돌을 다 깼다 — 보너스를 주고 다음 스테이지(5 다음은 1, 더 빠르게) */
function clearStage(g: Game, ev: StepEvent[]): void {
    const bonus = STAGE_BONUS * (1 + g.loop) + g.lives * LIFE_BONUS;
    g.score += bonus;
    g.stagesCleared++;
    g.stage = (g.stage + 1) % STAGES.length;
    if (g.stage === 0) g.loop++;
    loadStage(g);
    resetBall(g);
    ev.push({ type: 'clear', bonus });
}

function end(g: Game, reason: EndReason, ev: StepEvent[]): void {
    g.over = true;
    g.reason = reason;
    ev.push({ type: 'over', reason });
}

/** 한 틱 진행. 끝난 판이면 아무것도 하지 않는다 */
export function step(g: Game, input: StepInput): StepEvent[] {
    const ev: StepEvent[] = [];
    if (g.over) return ev;

    // 1) 막대
    const x = clamp(Math.trunc(Number(input.x) || 0), 0, FIELD_W);
    if (x !== g.lastX) {
        g.log.moves.push(g.tick, x);
        g.lastX = x;
    }
    if (g.wideTicks > 0 && --g.wideTicks === 0) g.paddleHalf = (PADDLE_W * S) / 2;
    if (g.slowTicks > 0) g.slowTicks--;
    g.paddlePrevX = g.paddleX;
    g.paddleX = clampPaddle(g, x * S);

    for (const b of g.balls) {
        b.px = b.x;
        b.py = b.y;
    }
    for (const it of g.items) it.py = it.y;

    // 2) 공
    if (g.attached) {
        const b = g.balls[0];
        b.x = g.paddleX;
        b.y = ATTACH_Y;
        if (input.launch) {
            b.a = LAUNCH_ANGLE;
            b.sx = g.paddleX <= FW / 2 ? 1 : -1;
            b.sy = -1;
            b.idle = 0;
            g.attached = false;
            g.log.launches.push(g.tick);
            ev.push({ type: 'launch' });
        }
    } else {
        const speed = ballSpeed(g);
        let w = 0;
        for (let k = 0; k < g.balls.length; k++) {
            const b = g.balls[k];
            if (moveBall(g, b, speed, ev)) g.balls[w++] = b;
            else ev.push({ type: 'ball-lost' });
        }
        g.balls.length = w;
    }

    // 3) 아이템
    updateItems(g, ev);

    // 4) 클리어 / 목숨
    if (g.remaining === 0) {
        clearStage(g, ev);
    } else if (!g.attached && g.balls.length === 0) {
        g.lives--;
        ev.push({ type: 'life-lost' });
        if (g.lives <= 0) end(g, 'lives', ev);
        else resetBall(g);
    }

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
    /** 막대 x 가 0~360 밖 */
    | 'x-range'
    /** 바로 앞 값과 같은 x (엔진은 바뀐 틱만 남긴다) */
    | 'x-unchanged'
    /** 판 길이를 넘는 틱의 입력 */
    | 'tick-range'
    /** 공이 붙어 있지 않은 틱의 발사 */
    | 'launch-detached'
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
    if (!log || !isTickList(log.moves) || !isTickList(log.launches)) return 'bad-log';
    if (log.moves.length % 2 !== 0) return 'bad-log';
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
    prevTick = -1;
    for (const t of log.launches) {
        if (t <= prevTick) return 'tick-order';
        if (t >= ticks) return 'tick-range';
        prevTick = t;
    }
    return '';
}

/**
 * 입력 기록으로 판을 처음부터 다시 돌린다 — 판 길이 ticks 까지.
 * 기록이 엔진이 남기는 모양과 다르면(순서·범위·중복·붙어 있지 않을 때 발사·길이) 조용히 넘기지 않고
 * ok=false 와 이유를 돌려준다.
 */
export function replay(seed: number, log: GameLog, ticks: number): ReplayResult {
    const g = createGame(seed);
    const bad = checkLog(log, ticks);
    if (bad) return { ok: false, error: bad, game: g };
    let x = START_X;
    let mi = 0;
    let li = 0;
    for (let t = 0; t < ticks; t++) {
        if (g.over) return { ok: false, error: 'length', game: g };
        if (mi < log.moves.length && log.moves[mi] === t) {
            x = log.moves[mi + 1];
            mi += 2;
        }
        let launch = false;
        if (li < log.launches.length && log.launches[li] === t) {
            if (!g.attached) return { ok: false, error: 'launch-detached', game: g };
            launch = true;
            li++;
        }
        step(g, { x, launch });
    }
    return { ok: true, error: '', game: g };
}

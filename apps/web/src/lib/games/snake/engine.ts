/**
 * 뱀 게임 규칙 — DOM 없음, 결정적(deterministic).
 *
 * 같은 seed 와 같은 입력 기록을 넣으면 언제 어디서 돌려도 같은 먹이 위치·같은 점수가 나온다.
 * 서버(stack-ws)가 같은 규칙을 Go 로 옮겨 들고 있어 끝난 판을 다시 돌려(재연) 점수를 확인한다.
 * 규칙을 바꾸면 서버 쪽과 공용 테스트 벡터(testdata/vectors.json)도 같이 바꿔야 한다.
 *
 * 규칙(기존 화면과 같다)
 * - 20×20 칸. 시작 뱀은 (10,10)(9,10)(8,10), 오른쪽을 본다.
 * - 한 틱에 한 칸. 틱 간격 = max(60, 150 − floor(점수/3)×5) ms (먹을 때마다 다시 잰다).
 * - 벽에 닿거나 몸(꼬리 끝 칸 포함)에 닿으면 끝. 먹이 1개 = 1점, 먹으면 한 칸 길어진다.
 * - 반대 방향(180°)으로는 바로 돌 수 없다 — 「지금 가고 있는 방향」의 반대만 막는다.
 *
 * 입력 기록 = [[틱, 방향], …]
 * - 방향 전환은 「다음 틱」에 적용된다. [t, d] 는 t 번째 이동(0부터)을 하기 직전에 방향이 d 로 바뀐다는 뜻.
 * - 한 틱에 하나만, 틱은 엄격히 증가. 방향이 실제로 바뀐 틱만 남긴다(같은 방향·반대 방향은 기록하지 않는다).
 */

export const GRID = 20;
/** 첫 틱 간격 (ms) */
export const BASE_SPEED_MS = 150;
/** 가장 빠른 틱 간격 (ms) */
export const MIN_SPEED_MS = 60;
/** 판 하나의 최대 틱 — 넘으면 판이 끝난다(서버 재연 상한과 같다) */
export const MAX_TICKS = 20000;

/** 방향 — 시계 방향 순서라 (d + 2) % 4 가 반대 방향이다 */
export const DIR_UP = 0;
export const DIR_RIGHT = 1;
export const DIR_DOWN = 2;
export const DIR_LEFT = 3;
export type Dir = 0 | 1 | 2 | 3;

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface Pos {
    x: number;
    y: number;
}

/** 끝난 이유: wall=벽, self=몸, full=빈칸 없음, limit=최대 틱 */
export type EndReason = '' | 'wall' | 'self' | 'full' | 'limit';

/** 입력 기록 한 줄: [틱, 방향] */
export type SnakeInput = [number, number];

export interface SnakeGame {
    /** 머리가 0번 */
    snake: Pos[];
    dir: Dir;
    /** 먹이 (빈칸이 없으면 null) */
    food: Pos | null;
    score: number;
    /** 지금까지 한 이동 수 */
    tick: number;
    /** 지금까지의 틱 간격 합(ms) — 이 판을 사람이 하는 데 걸리는 최소 시간 */
    simMs: number;
    over: boolean;
    reason: EndReason;
    /** 난수 상태 (uint32) */
    rng: number;
}

/** 점수에 따른 틱 간격 (ms) */
export function speedFor(score: number): number {
    return Math.max(MIN_SPEED_MS, BASE_SPEED_MS - Math.floor(score / 3) * 5);
}

/** d 의 반대 방향 */
export function opposite(d: number): number {
    return (d + 2) % 4;
}

/** 0~3 정수인가 */
export function isDir(d: unknown): d is Dir {
    return d === 0 || d === 1 || d === 2 || d === 3;
}

/**
 * mulberry32 — 32비트 정수 연산만 쓰는 작은 난수기. 다음 상태와 값(uint32)을 돌려준다.
 * Go 쪽은 uint32 산술로 같은 값을 낸다.
 */
export function mulberry32(state: number): [number, number] {
    const s = (state + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [s, (t ^ (t >>> 14)) >>> 0];
}

/**
 * 먹이 놓기 — 빈칸을 행 우선(y, 그다음 x) 순서로 세우고 floor(u × 빈칸 수 / 2³²) 번째를 고른다.
 * u × n 은 2⁴¹ 보다 작아 부동소수점으로도 정확하다. 빈칸이 없으면 null.
 */
function placeFood(g: SnakeGame): Pos | null {
    const occupied = new Uint8Array(GRID * GRID);
    for (const p of g.snake) occupied[p.y * GRID + p.x] = 1;
    const free: number[] = [];
    for (let i = 0; i < GRID * GRID; i++) if (!occupied[i]) free.push(i);
    if (free.length === 0) return null;
    const [next, u] = mulberry32(g.rng);
    g.rng = next;
    const cell = free[Math.floor((u * free.length) / 4294967296)];
    return { x: cell % GRID, y: Math.floor(cell / GRID) };
}

/** 새 판 — seed 는 uint32 */
export function createGame(seed: number): SnakeGame {
    const mid = Math.floor(GRID / 2);
    const g: SnakeGame = {
        snake: [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid }
        ],
        dir: DIR_RIGHT,
        food: null,
        score: 0,
        tick: 0,
        simMs: 0,
        over: false,
        reason: '',
        rng: seed >>> 0
    };
    g.food = placeFood(g);
    return g;
}

/** 이 방향으로 지금 돌 수 있는가 (같은 방향·반대 방향은 아니다) */
export function canTurn(g: SnakeGame, d: number): boolean {
    return isDir(d) && d !== g.dir && d !== opposite(g.dir);
}

/**
 * 한 틱 — want 방향으로 돌 수 있으면 돌고 한 칸 간다. 먹었으면 true.
 * 반대 방향 want 는 무시한다(기존 화면 규칙).
 */
export function step(g: SnakeGame, want: number = g.dir): boolean {
    if (g.over) return false;
    if (canTurn(g, want)) g.dir = want as Dir;
    g.simMs += speedFor(g.score);
    g.tick++;
    const head = { x: g.snake[0].x + DX[g.dir], y: g.snake[0].y + DY[g.dir] };
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        return end(g, 'wall');
    }
    if (g.snake.some((s) => s.x === head.x && s.y === head.y)) return end(g, 'self');
    g.snake.unshift(head);
    let ate = false;
    if (g.food && head.x === g.food.x && head.y === g.food.y) {
        ate = true;
        g.score++;
        g.food = placeFood(g);
        if (!g.food) return end(g, 'full', true);
    } else {
        g.snake.pop();
    }
    if (g.tick >= MAX_TICKS) end(g, 'limit');
    return ate;
}

/**
 * 화면용 한 틱 — 이번 틱에 방향이 실제로 바뀌면 입력 기록에 [틱, 방향] 을 남기고 step 한다.
 * 이렇게 모은 기록은 replay() 로 똑같이 다시 돌아간다.
 */
export function stepRecorded(g: SnakeGame, inputs: SnakeInput[], want: number): boolean {
    if (!g.over && canTurn(g, want)) inputs.push([g.tick, want]);
    return step(g, want);
}

function end(g: SnakeGame, reason: EndReason, ate = false): boolean {
    g.over = true;
    g.reason = reason;
    return ate;
}

/* ── 재연(서버와 같은 검사) ── */

export interface ReplayResult {
    /** 입력 기록이 규칙에 맞는가 */
    ok: boolean;
    /** 맞지 않으면 사유: shape | input_order | input_dir | input_after_end */
    error: string;
    score: number;
    ticks: number;
    simMs: number;
    reason: EndReason;
    /** 놓인 먹이 위치 순서(처음 먹이 포함) */
    foods: Pos[];
}

/** 입력 기록 모양 검사 — 길이·정수·방향 값·틱 순서. 통과면 빈 문자열 */
export function checkInputs(inputs: unknown): string {
    if (!Array.isArray(inputs) || inputs.length > MAX_TICKS) return 'shape';
    let last = -1;
    for (const it of inputs) {
        if (!Array.isArray(it) || it.length !== 2) return 'shape';
        const [t, d] = it;
        if (!Number.isInteger(t) || t < 0 || t >= MAX_TICKS) return 'shape';
        if (!isDir(d)) return 'input_dir';
        if (t <= last) return 'input_order';
        last = t;
    }
    return '';
}

/**
 * seed 와 입력 기록으로 판을 처음부터 끝(벽·몸·빈칸 없음·최대 틱)까지 다시 돌린다.
 * 기록된 방향이 그 틱에 돌 수 없는 방향이면 input_dir, 판이 끝난 뒤의 입력이 남으면 input_after_end.
 */
export function replay(seed: number, inputs: unknown): ReplayResult {
    const g = createGame(seed);
    const foods: Pos[] = g.food ? [{ ...g.food }] : [];
    const result = (error: string): ReplayResult => ({
        ok: error === '',
        error,
        score: g.score,
        ticks: g.tick,
        simMs: g.simMs,
        reason: g.reason,
        foods
    });
    const bad = checkInputs(inputs);
    if (bad) return result(bad);
    const list = inputs as SnakeInput[];
    let i = 0;
    while (!g.over) {
        let want: number = g.dir;
        if (i < list.length && list[i][0] === g.tick) {
            want = list[i][1];
            i++;
            if (!canTurn(g, want)) return result('input_dir');
        }
        const before = g.food;
        step(g, want);
        if (g.food && g.food !== before) foods.push({ ...g.food });
    }
    return result(i < list.length ? 'input_after_end' : '');
}

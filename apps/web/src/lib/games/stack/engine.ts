/**
 * 앙쌓기 게임 로직 — DOM 없음, 결정적(deterministic).
 *
 * 같은 seed 와 같은 「틱별 입력」을 넣으면 언제 어디서 돌려도 같은 판·같은 점수가 나온다.
 * 시간은 밀리초가 아니라 고정 틱(60Hz) 수로만 센다 — 나중에 서버에서 입력 기록을
 * 다시 돌려 점수를 검증할 수 있게 하기 위해서다.
 *
 * 판 크기 9×18: 가로를 홀수로 두면 3칸짜리 조각이 정확히 가운데에 나오고,
 * 1:2 비율이라 좁은 휴대폰 화면에서도 칸이 크게 보인다.
 */

export const COLS = 9;
export const ROWS = 18;
/** 고정 틱 길이 (ms) */
export const TICK_MS = 1000 / 60;
/** 이 줄 수마다 레벨이 오른다 */
export const LINES_PER_LEVEL = 8;
/** 바닥에 닿은 뒤 굳기까지의 틱 */
const LOCK_TICKS = 30;
/** 바닥에서 움직여 굳기를 미룰 수 있는 최대 횟수 */
const MAX_LOCK_RESETS = 12;
/** 지운 줄 수(0~4)별 기본 점수 — 레벨을 곱한다 */
const LINE_SCORES = [0, 100, 250, 450, 700];

/** 대전에서 상대가 보낸 방해 줄의 칸 값 (조각 칸 1~7 과 겹치지 않는다) */
export const GARBAGE = 8;

/* ── 입력 비트 (한 틱에 여러 개를 OR 로 묶는다) ── */
export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_CW = 4;
export const IN_CCW = 8;
export const IN_SOFT = 16;
export const IN_HARD = 32;

/** 조각 종류 0~6 */
export type Kind = number;

/** 기본 방향 모양 (#=칸). 상자 크기 = 줄 수. 네 칸짜리 조각 일곱 가지 */
const BASE: string[][] = [
    ['....', '####', '....', '....'], // 0 막대
    ['##', '##'], // 1 네모
    ['.#.', '###', '...'], // 2 산
    ['.##', '##.', '...'], // 3 오른계단
    ['##.', '.##', '...'], // 4 왼계단
    ['#..', '###', '...'], // 5 왼갈고리
    ['..#', '###', '...'] // 6 오른갈고리
];

/** 조각별 상자 크기 */
export const BOX: number[] = BASE.map((rows) => rows.length);

/** SHAPES[kind][rot] = 칸 좌표 목록 (시계 방향 회전 4단계) */
export const SHAPES: [number, number][][][] = BASE.map((rows) => {
    const n = rows.length;
    const cells: [number, number][] = [];
    rows.forEach((row, y) => {
        for (let x = 0; x < n; x++) if (row[x] === '#') cells.push([x, y]);
    });
    const rots = [cells];
    for (let i = 1; i < 4; i++) {
        rots.push(rots[i - 1].map(([x, y]) => [n - 1 - y, x] as [number, number]));
    }
    return rots;
});

/** 회전이 막히면 순서대로 시도하는 위치 보정 (벽·바닥에서 밀어내기) */
const KICKS: [number, number][] = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1]
];

export interface Piece {
    kind: Kind;
    rot: number;
    x: number;
    y: number;
}

/** 게임 상태 — 평범한 객체라 그대로 복제·직렬화할 수 있다 */
export interface Game {
    rng: number;
    bag: Kind[];
    /** ROWS*COLS, 0=빈칸, 1~7=굳은 조각(kind+1) */
    board: number[];
    piece: Piece;
    next: Kind;
    score: number;
    lines: number;
    level: number;
    over: boolean;
    tick: number;
    fall: number;
    lock: number;
    resets: number;
}

export interface StepResult {
    /** 화면을 다시 그려야 하는가 */
    dirty: boolean;
    /** 이번 틱에 조각이 굳었는가 */
    locked: boolean;
    /** 이번 틱에 지운 줄 수 */
    cleared: number;
}

/** mulberry32 — 상태를 g.rng 에 두어 게임과 함께 직렬화된다 */
function random(g: Game): number {
    let t = (g.rng = (g.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 7개 한 주머니를 섞어 차례로 꺼낸다 — 같은 조각이 너무 오래 안 나오는 일이 없다 */
function pull(g: Game): Kind {
    if (g.bag.length === 0) {
        const bag = [0, 1, 2, 3, 4, 5, 6];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(random(g) * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        g.bag = bag;
    }
    return g.bag.shift() as Kind;
}

/** 레벨별 한 칸 떨어지는 데 걸리는 틱 */
export function gravityTicks(level: number): number {
    return Math.max(2, 50 - (level - 1) * 5);
}

/** 한 번에 지운 줄 수에 대한 점수 */
export function scoreFor(cleared: number, level: number): number {
    return (LINE_SCORES[cleared] ?? 0) * level;
}

/** 그 자리에 조각이 들어갈 수 있는가. 판 위쪽(y<0)은 비어 있는 것으로 본다 */
export function fits(g: Game, kind: Kind, rot: number, x: number, y: number): boolean {
    for (const [cx, cy] of SHAPES[kind][rot]) {
        const px = x + cx;
        const py = y + cy;
        if (px < 0 || px >= COLS || py >= ROWS) return false;
        if (py >= 0 && g.board[py * COLS + px] !== 0) return false;
    }
    return true;
}

function spawn(g: Game, kind: Kind): void {
    g.piece = { kind, rot: 0, x: Math.floor((COLS - BOX[kind]) / 2), y: kind === 0 ? -1 : 0 };
    g.fall = 0;
    g.lock = 0;
    g.resets = 0;
    if (!fits(g, kind, 0, g.piece.x, g.piece.y)) g.over = true;
}

export function createGame(seed: number): Game {
    const g: Game = {
        rng: seed >>> 0,
        bag: [],
        board: new Array<number>(COLS * ROWS).fill(0),
        piece: { kind: 0, rot: 0, x: 0, y: 0 },
        next: 0,
        score: 0,
        lines: 0,
        level: 1,
        over: false,
        tick: 0,
        fall: 0,
        lock: 0,
        resets: 0
    };
    const first = pull(g);
    g.next = pull(g);
    spawn(g, first);
    return g;
}

function tryMove(g: Game, dx: number, dy: number): boolean {
    const p = g.piece;
    if (!fits(g, p.kind, p.rot, p.x + dx, p.y + dy)) return false;
    p.x += dx;
    p.y += dy;
    return true;
}

/** dir: 1=시계, 3=반시계 */
function tryRotate(g: Game, dir: number): boolean {
    const p = g.piece;
    if (BOX[p.kind] === 2) return false; // 네모는 돌려도 같다
    const rot = (p.rot + dir) & 3;
    for (const [kx, ky] of KICKS) {
        // 위로 올리는 보정은 굳기 미루기 횟수를 쓴다 — 바닥에서 끝없이 버티지 못하게
        if (ky < 0 && g.resets >= MAX_LOCK_RESETS) continue;
        if (fits(g, p.kind, rot, p.x + kx, p.y + ky)) {
            if (ky < 0) g.resets++;
            p.rot = rot;
            p.x += kx;
            p.y += ky;
            return true;
        }
    }
    return false;
}

/** 꽉 찬 줄을 지우고 위를 내린다. 지운 줄 수를 돌려준다 */
function clearLines(g: Game): number {
    const b = g.board;
    let write = ROWS - 1;
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        let full = true;
        for (let c = 0; c < COLS; c++) {
            if (b[r * COLS + c] === 0) {
                full = false;
                break;
            }
        }
        if (full) {
            cleared++;
            continue;
        }
        if (write !== r) {
            for (let c = 0; c < COLS; c++) b[write * COLS + c] = b[r * COLS + c];
        }
        write--;
    }
    for (; write >= 0; write--) {
        for (let c = 0; c < COLS; c++) b[write * COLS + c] = 0;
    }
    return cleared;
}

function lockPiece(g: Game, res: StepResult): void {
    const p = g.piece;
    let outside = false;
    for (const [cx, cy] of SHAPES[p.kind][p.rot]) {
        const y = p.y + cy;
        if (y < 0) {
            outside = true;
            continue;
        }
        g.board[y * COLS + p.x + cx] = p.kind + 1;
    }
    res.locked = true;
    res.dirty = true;
    const n = clearLines(g);
    res.cleared = n;
    if (n > 0) {
        g.score += scoreFor(n, g.level);
        g.lines += n;
        g.level = 1 + Math.floor(g.lines / LINES_PER_LEVEL);
    }
    // 판 위로 삐져나온 채 굳으면 끝
    if (outside) {
        g.over = true;
        return;
    }
    const kind = g.next;
    g.next = pull(g);
    spawn(g, kind);
}

/**
 * 고정 틱 하나를 진행한다. input 은 IN_* 비트의 OR.
 * 키 반복(DAS/ARR)은 호출하는 쪽이 틱 단위로 만들어 넣는다 — 그래야 입력 기록만으로 재현된다.
 */
export function step(g: Game, input: number): StepResult {
    const res: StepResult = { dirty: false, locked: false, cleared: 0 };
    if (g.over) return res;
    g.tick++;
    const p = g.piece;

    let moved = false;
    if ((input & IN_LEFT) !== 0 && tryMove(g, -1, 0)) moved = true;
    if ((input & IN_RIGHT) !== 0 && tryMove(g, 1, 0)) moved = true;
    if ((input & IN_CW) !== 0 && tryRotate(g, 1)) moved = true;
    if ((input & IN_CCW) !== 0 && tryRotate(g, 3)) moved = true;
    if (moved) {
        res.dirty = true;
        if (g.lock > 0 && g.resets < MAX_LOCK_RESETS) {
            g.lock = 0;
            g.resets++;
        }
    }

    if ((input & IN_HARD) !== 0) {
        let dist = 0;
        while (tryMove(g, 0, 1)) dist++;
        g.score += dist * 2;
        lockPiece(g, res);
        return res;
    }

    const soft = (input & IN_SOFT) !== 0;
    const normal = gravityTicks(g.level);
    const interval = soft ? Math.min(2, normal) : normal;
    if (fits(g, p.kind, p.rot, p.x, p.y + 1)) {
        g.lock = 0;
        g.fall++;
        if (g.fall >= interval) {
            g.fall = 0;
            p.y++;
            if (soft) g.score += 1;
            res.dirty = true;
        }
    } else {
        g.fall = 0;
        g.lock++;
        if (g.lock >= LOCK_TICKS) lockPiece(g, res);
    }
    return res;
}

/**
 * 대전용 방해 줄 — 판 전체를 lines 줄 위로 밀고, 바닥 lines 줄을 hole 열만 빼고 GARBAGE 로 채운다.
 * 칸이 있는 줄이 판 위로 밀려 나가면 끝. 떨어지던 조각이 새 칸과 겹치면 최대 lines 칸까지
 * 위로 올려 보고, 그래도 겹치면 끝. hole 이 0~COLS-1 밖이면 가장 가까운 열로 맞춘다.
 */
export function addGarbage(g: Game, lines: number, hole: number): void {
    if (g.over) return;
    const n = Math.min(Math.floor(lines), ROWS);
    if (n <= 0) return;
    // 판 밖 구멍 열은 가장 가까운 열로 맞춘다
    const h = Math.min(COLS - 1, Math.max(0, Math.floor(hole) || 0));
    const b = g.board;
    const shift = n * COLS;
    // 판 위로 밀려 나갈 칸이 있는가
    for (let i = 0; i < shift; i++) {
        if (b[i] !== 0) {
            g.over = true;
            break;
        }
    }
    for (let i = 0; i < (ROWS - n) * COLS; i++) b[i] = b[i + shift];
    for (let r = ROWS - n; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) b[r * COLS + c] = c === h ? 0 : GARBAGE;
    }
    const p = g.piece;
    for (let up = 0; up < n && !fits(g, p.kind, p.rot, p.x, p.y); up++) p.y--;
    if (!fits(g, p.kind, p.rot, p.x, p.y)) g.over = true;
}

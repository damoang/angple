/**
 * 오목 AI 상대 — 순수 함수 모음 (화면·Worker 공용, DOM 의존 없음).
 *
 * 난이도별 탐색:
 *   초급 — 1수 앞(내 수의 모양 점수만) + 큰 무작위 흔들림
 *   중급 — 2수 앞(내 수 → 상대 응수) 탐색 + 작은 흔들림
 *   고급 — 3수 앞 알파베타 탐색(후보를 모양 점수 상위 N개로 제한) · 흔들림 없음 · 시간 상한
 *
 * 모든 난이도 공통: 바로 이기는 수가 있으면 두고, 상대가 바로 이기는 자리는 막는다.
 * 고급은 깊이를 1→2→3 으로 늘려 가며(반복 심화) 시간이 다 되면 마지막으로 끝난 깊이의 수를 쓴다.
 */

export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Board = number[][];
export type Move = { x: number; y: number };
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultySetting {
    /** 화면 표시 이름 */
    label: string;
    /** 탐색 깊이(수) */
    depth: number;
    /** 무작위 흔들림 폭 (0 = 없음) */
    noise: number;
    /** 노드마다 살펴볼 후보 수 상한 (0 = 제한 없음) */
    topN: number;
    /** 한 수 생각 시간 상한(ms). 깊이 2 이상에서만 쓴다 */
    timeLimitMs: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySetting> = {
    easy: { label: '초급', depth: 1, noise: 3000, topN: 0, timeLimitMs: 0 },
    medium: { label: '중급', depth: 2, noise: 300, topN: 12, timeLimitMs: 1500 },
    hard: { label: '고급', depth: 3, noise: 0, topN: 10, timeLimitMs: 1500 }
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export function isDifficulty(v: unknown): v is Difficulty {
    return v === 'easy' || v === 'medium' || v === 'hard';
}

export function createBoard(): Board {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

export function cloneBoard(b: Board): Board {
    return b.map((row) => row.slice());
}

const DIRS: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
];

/** (x,y) 에 놓인 player 돌로 5목 이상이 되면 그 줄 좌표를, 아니면 null */
export function checkWin(
    b: Board,
    x: number,
    y: number,
    player: number
): [number, number][] | null {
    for (const [dx, dy] of DIRS) {
        const line: [number, number][] = [[x, y]];
        for (let d = 1; d < 5; d++) {
            const nx = x + dx * d,
                ny = y + dy * d;
            if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || b[ny][nx] !== player) break;
            line.push([nx, ny]);
        }
        for (let d = 1; d < 5; d++) {
            const nx = x - dx * d,
                ny = y - dy * d;
            if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || b[ny][nx] !== player) break;
            line.push([nx, ny]);
        }
        if (line.length >= 5) return line;
    }
    return null;
}

/* ── 모양 점수 ── '1' = 내 돌, '0' = 빈칸, '2' = 상대 돌·판 밖 */
const PATTERNS: [string, number][] = [
    ['11111', 1000000],
    ['011110', 50000],
    ['011112', 5000],
    ['211110', 5000],
    ['01110', 5000],
    ['010110', 3000],
    ['011010', 3000],
    ['001112', 500],
    ['211100', 500],
    ['00110', 500],
    ['01100', 500],
    ['01010', 500],
    ['010010', 300]
];

/** 한 수만 더 두면 열린 4가 되는 열린 3 모양 */
const OPEN_THREES = ['001110', '011100', '010110', '011010'];

function patternScore(line: string): number {
    let score = 0;
    for (const [pat, val] of PATTERNS) {
        let idx = 0;
        while ((idx = line.indexOf(pat, idx)) !== -1) {
            score += val;
            idx++;
        }
    }
    return score;
}

/** (x,y) 를 지나는 한 방향 9칸의 모양 점수 */
function evaluateDir(b: Board, x: number, y: number, dx: number, dy: number, player: number) {
    let line = '';
    for (let i = -4; i <= 4; i++) {
        const nx = x + dx * i,
            ny = y + dy * i;
        if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) line += '2';
        else if (b[ny][nx] === player) line += '1';
        else if (b[ny][nx] === EMPTY) line += '0';
        else line += '2';
    }
    return patternScore(line);
}

/** (x,y) 에 player 돌이 놓였다고 볼 때 그 자리의 모양 점수 (+ 중앙 가산) */
export function evaluatePosition(b: Board, x: number, y: number, player: number): number {
    let score = 0;
    for (const [dx, dy] of DIRS) score += evaluateDir(b, x, y, dx, dy, player);
    const center = Math.floor(SIZE / 2);
    const dist = Math.abs(x - center) + Math.abs(y - center);
    return score + Math.max(0, (14 - dist) * 2);
}

/** 후보 정렬용 점수 — 내가 두면 얻는 공격 점수 + 상대 자리를 뺏는 수비 점수 */
export function scoreMove(b: Board, x: number, y: number, player: number): number {
    const opp = 3 - player;
    b[y][x] = player;
    let score = evaluatePosition(b, x, y, player) * 1.1;
    b[y][x] = opp;
    score += evaluatePosition(b, x, y, opp);
    b[y][x] = EMPTY;
    return score;
}

/** 기존 돌에서 2칸 이내의 빈칸 */
export function getCandidates(b: Board): Move[] {
    const seen = new Uint8Array(SIZE * SIZE);
    const out: Move[] = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (b[y][x] === EMPTY) continue;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const nx = x + dx,
                        ny = y + dy;
                    if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
                    if (b[ny][nx] !== EMPTY || seen[ny * SIZE + nx]) continue;
                    seen[ny * SIZE + nx] = 1;
                    out.push({ x: nx, y: ny });
                }
            }
        }
    }
    return out;
}

/** player 가 지금 두면 바로 이기는 자리 (없으면 null) */
export function findWinningMove(b: Board, player: number): Move | null {
    for (const m of getCandidates(b)) {
        b[m.y][m.x] = player;
        const won = checkWin(b, m.x, m.y, player) !== null;
        b[m.y][m.x] = EMPTY;
        if (won) return m;
    }
    return null;
}

/** 후보를 모양 점수 순으로 정렬해 상위 topN 개 (0 = 전부) */
export function orderMoves(b: Board, player: number, topN: number): Move[] {
    const scored = getCandidates(b).map((m) => ({ m, s: scoreMove(b, m.x, m.y, player) }));
    scored.sort((a, c) => c.s - a.s);
    const list = topN > 0 ? scored.slice(0, topN) : scored;
    return list.map((e) => e.m);
}

/* ── 판 전체 평가 ── */

/** 길이 5 이상인 모든 가로·세로·대각선 줄의 좌표 목록 (한 번만 만든다) */
const LINES: [number, number][][] = (() => {
    const lines: [number, number][][] = [];
    for (let i = 0; i < SIZE; i++) {
        lines.push(Array.from({ length: SIZE }, (_, k) => [k, i] as [number, number]));
        lines.push(Array.from({ length: SIZE }, (_, k) => [i, k] as [number, number]));
    }
    for (let s = -(SIZE - 5); s <= SIZE - 5; s++) {
        const diag: [number, number][] = [];
        const anti: [number, number][] = [];
        for (let x = 0; x < SIZE; x++) {
            const y = x - s;
            if (y >= 0 && y < SIZE) diag.push([x, y]);
            const y2 = SIZE - 1 - x + s;
            if (y2 >= 0 && y2 < SIZE) anti.push([x, y2]);
        }
        lines.push(diag, anti);
    }
    return lines;
})();

interface SideInfo {
    score: number;
    /** 한 수만 더 두면 5목이 되는 빈칸 수 (줄마다 셈) */
    fours: number;
    /** 열린 3 이 있는 줄 수 */
    threes: number;
}

function analyzeSide(b: Board, player: number): SideInfo {
    const info: SideInfo = { score: 0, fours: 0, threes: 0 };
    for (const cells of LINES) {
        let line = '2';
        let stones = 0;
        for (const [x, y] of cells) {
            const v = b[y][x];
            if (v === player) {
                line += '1';
                stones++;
            } else if (v === EMPTY) line += '0';
            else line += '2';
        }
        line += '2';
        // 돌이 1개 이하인 줄은 어떤 모양에도 걸리지 않는다
        if (stones < 2) continue;
        info.score += patternScore(line);
        for (let i = 1; i < line.length - 1; i++) {
            if (line[i] !== '0') continue;
            let run = 1;
            for (let j = i - 1; line[j] === '1'; j--) run++;
            for (let j = i + 1; line[j] === '1'; j++) run++;
            if (run >= 5) info.fours++;
        }
        for (const pat of OPEN_THREES) {
            if (line.includes(pat)) {
                info.threes++;
                break;
            }
        }
    }
    return info;
}

export const WIN_SCORE = 100_000_000;

/** 둘 차례인 toMove 입장에서 본 판 점수 */
export function evaluateBoard(b: Board, toMove: number): number {
    const me = analyzeSide(b, toMove);
    const op = analyzeSide(b, 3 - toMove);
    // 내 차례에 4가 있으면 다음 수에 이긴다
    if (me.fours > 0) return WIN_SCORE / 2;
    // 상대 4가 둘 이상(열린 4 포함)이면 다 막을 수 없다
    if (op.fours >= 2) return -WIN_SCORE / 2;
    if (op.fours === 1) {
        // 4를 막느라 한 수를 쓴다 — 상대에게 열린 3까지 있으면 다음에 열린 4가 된다
        if (op.threes > 0) return -WIN_SCORE / 4;
        return me.score - op.score * 1.2;
    }
    // 내 차례에 열린 3 → 열린 4로 만들 수 있다
    if (me.threes > 0) return WIN_SCORE / 8 + me.score - op.score;
    if (op.threes >= 2) return -WIN_SCORE / 8;
    return me.score * 1.1 - op.score;
}

/* ── 탐색 ── */

class SearchTimeout extends Error {}

interface SearchCtx {
    deadline: number;
    now: () => number;
    nodes: number;
    topN: number;
}

function negamax(
    b: Board,
    depth: number,
    alpha: number,
    beta: number,
    player: number,
    ctx: SearchCtx
): number {
    if ((++ctx.nodes & 31) === 0 && ctx.now() > ctx.deadline) throw new SearchTimeout();
    if (depth === 0) return evaluateBoard(b, player);
    const moves = orderMoves(b, player, ctx.topN);
    if (moves.length === 0) return 0;
    let best = -Infinity;
    for (const m of moves) {
        b[m.y][m.x] = player;
        let v: number;
        if (checkWin(b, m.x, m.y, player)) v = WIN_SCORE + depth;
        else v = -negamax(b, depth - 1, -beta, -alpha, 3 - player, ctx);
        b[m.y][m.x] = EMPTY;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
    }
    return best;
}

export interface AiOptions {
    /** AI 돌 색 (기본 백) */
    player?: number;
    /** 0 이상 1 미만 난수 (테스트에서 고정) */
    rng?: () => number;
    /** 현재 시각(ms) (테스트에서 고정) */
    now?: () => number;
    /** 난이도 기본값 대신 쓸 시간 상한(ms) */
    timeLimitMs?: number;
}

export interface AiResult {
    move: Move;
    /** 끝까지 마친 탐색 깊이 (즉시 승리·차단·첫 수는 0) */
    depthReached: number;
    nodes: number;
}

function firstEmpty(b: Board): Move {
    const c = Math.floor(SIZE / 2);
    if (b[c][c] === EMPTY) return { x: c, y: c };
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) if (b[y][x] === EMPTY) return { x, y };
    return { x: c, y: c };
}

export function searchAiMove(board: Board, difficulty: Difficulty, opts: AiOptions = {}): AiResult {
    const player = opts.player ?? WHITE;
    const opp = 3 - player;
    const rng = opts.rng ?? Math.random;
    const now = opts.now ?? (() => Date.now());
    const setting = DIFFICULTY_SETTINGS[difficulty] ?? DIFFICULTY_SETTINGS.medium;
    // 호출자 판을 건드리지 않는다 (시간 초과로 탐색이 끊겨도 원본은 그대로)
    const b = cloneBoard(board);

    const candidates = getCandidates(b);
    if (candidates.length === 0) return { move: firstEmpty(b), depthReached: 0, nodes: 0 };

    const win = findWinningMove(b, player);
    if (win) return { move: win, depthReached: 0, nodes: 0 };
    const block = findWinningMove(b, opp);
    if (block) return { move: block, depthReached: 0, nodes: 0 };

    // 초급: 1수 앞 모양 점수 + 큰 흔들림
    if (setting.depth <= 1) {
        let best = candidates[0];
        let bestScore = -Infinity;
        for (const m of candidates) {
            const s = scoreMove(b, m.x, m.y, player) + rng() * setting.noise;
            if (s > bestScore) {
                bestScore = s;
                best = m;
            }
        }
        return { move: best, depthReached: 1, nodes: candidates.length };
    }

    // 중급·고급: 반복 심화 negamax (뿌리 후보 상위 N개)
    const ctx: SearchCtx = { deadline: Infinity, now, nodes: 0, topN: setting.topN };
    let rootMoves = orderMoves(b, player, setting.topN);
    let bestMove = rootMoves[0];
    let depthReached = 0;
    // 시간 상한은 한 수 전체에 한 번 — 깊이마다 새로 주지 않는다
    const deadline = now() + (opts.timeLimitMs ?? setting.timeLimitMs);

    for (let depth = 1; depth <= setting.depth; depth++) {
        // 깊이 1 은 금방 끝나므로 항상 마친다 — 시간이 없어도 최소한의 판단은 한다
        ctx.deadline = depth === 1 ? Infinity : deadline;
        const work = cloneBoard(b);
        const scored: { m: Move; v: number }[] = [];
        let alpha = -Infinity;
        try {
            for (const m of rootMoves) {
                work[m.y][m.x] = player;
                let v: number;
                if (checkWin(work, m.x, m.y, player)) v = WIN_SCORE + depth;
                // 흔들림이 있으면 후보마다 정확한 값이 필요해 창을 좁히지 않는다
                else
                    v = -negamax(
                        work,
                        depth - 1,
                        -Infinity,
                        setting.noise > 0 ? Infinity : -alpha,
                        opp,
                        ctx
                    );
                work[m.y][m.x] = EMPTY;
                scored.push({ m, v });
                if (v > alpha) alpha = v;
            }
        } catch (e) {
            if (e instanceof SearchTimeout) break;
            throw e;
        }
        // 다음 깊이는 이번 깊이의 좋은 수부터 본다
        scored.sort((a, c) => c.v - a.v);
        rootMoves = scored.map((s) => s.m);
        depthReached = depth;
        if (setting.noise > 0 && depth === setting.depth) {
            let bestScore = -Infinity;
            for (const s of scored) {
                const v = s.v + rng() * setting.noise;
                if (v > bestScore) {
                    bestScore = v;
                    bestMove = s.m;
                }
            }
        } else {
            bestMove = scored[0].m;
        }
        // 이기는 길을 찾았으면 더 볼 필요 없다
        if (scored[0].v >= WIN_SCORE) break;
    }

    return { move: bestMove, depthReached, nodes: ctx.nodes };
}

export function getAiMove(board: Board, difficulty: Difficulty, opts: AiOptions = {}): Move {
    return searchAiMove(board, difficulty, opts).move;
}

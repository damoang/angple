/**
 * 장기 AI 상대 — 난이도별 탐색. 순수 함수라 Web Worker 와 메인 스레드 양쪽에서 돈다.
 *
 * 깊이는 「수(ply)」 단위로 센다(내가 두는 수 1 + 상대 응수 1 + …).
 * - 초급: 1수 + 루트 무작위 가산(잡을 수 있는 건 대개 잡지만 나머지는 아무렇게나)
 * - 중급: 3수 = 기존 AI(루트 + minimax 깊이 2) 와 같은 탐색·같은 평가(기물 점수만)
 * - 고급: 반복 심화로 최대 5수(= minimax 깊이 4), 잡는 수 우선 정렬(MVV-LVA)·
 *         직전 반복 최선수 우선 + 위치 평가(졸 전진·궁성 안전·차/포/마 활동성)
 * 모든 난이도는 한 수 생각 시간 상한(기본 3초)을 넘기면 마지막으로 끝난 깊이의 최선수를 낸다.
 */
import {
    KIND,
    SCORES,
    TEAM,
    getBoard,
    getMoves,
    inPalace,
    type Board,
    type JanggiPiece,
    type Point
} from './rules';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
    easy: '초급',
    normal: '중급',
    hard: '고급'
};

export interface DifficultyConfig {
    /** 최대 탐색 깊이(ply, 루트 수 포함) */
    maxDepth: number;
    /** 루트 후보 점수에 더하는 무작위 폭(0 = 없음) */
    noise: number;
    /** 잡는 수 우선(MVV-LVA) + 직전 반복 최선수 우선 정렬 */
    ordering: boolean;
    /** 위치 평가 사용 */
    positional: boolean;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
    easy: { maxDepth: 1, noise: 350, ordering: false, positional: false },
    normal: { maxDepth: 3, noise: 0, ordering: false, positional: false },
    hard: { maxDepth: 5, noise: 0, ordering: true, positional: true }
};

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** 한 수 생각 시간 상한(ms). */
export const THINK_TIME_LIMIT_MS = 3000;

export function isDifficulty(v: unknown): v is Difficulty {
    return v === 'easy' || v === 'normal' || v === 'hard';
}

const MATE = 1_000_000;
const ABORT = Symbol('abort');

export interface SearchOptions {
    timeLimitMs?: number;
    now?: () => number;
    random?: () => number;
    /** 테스트·폴백용 깊이 상한(난이도 설정보다 작을 때만 적용) */
    maxDepth?: number;
}

export interface SearchResult {
    /** pieces 배열 인덱스 */
    index: number;
    from: Point;
    to: Point;
    score: number;
    /** 끝까지 마친 탐색 깊이(ply) */
    depth: number;
    nodes: number;
}

interface SearchMove {
    index: number;
    to: Point;
    order: number;
}

function other(team: number): number {
    return team === TEAM.CHO ? TEAM.HAN : TEAM.CHO;
}

/** MVV-LVA 정렬 키 — 비싼 말을 싼 말로 잡는 수가 앞. 잡지 않는 수는 0. */
export function mvvLva(attackerKind: number, victimKind: number | null): number {
    if (victimKind === null) return 0;
    return SCORES[victimKind] * 10 - SCORES[attackerKind] / 10;
}

function positionalScore(p: JanggiPiece, board: Board, pcs: JanggiPiece[]): number {
    switch (p.kind) {
        case KIND.JOLE: {
            // 전진할수록 가산, 강 건너면 추가
            const progress = p.team === TEAM.CHO ? 6 - p.y : p.y - 3;
            return progress * 12 + (progress >= 2 ? 20 : 0);
        }
        case KIND.GUNG: {
            // 궁성 중앙 + 곁을 지키는 사
            let s = p.x === 4 && (p.y === 1 || p.y === 8) ? 25 : 0;
            for (const q of pcs) {
                if (q.alive && q.team === p.team && q.kind === KIND.SA) {
                    if (inPalace(q.x, q.y, p.team)) s += 20;
                }
            }
            return s;
        }
        case KIND.CHA:
            return getMoves(p, board).length * 6;
        case KIND.PO:
            return getMoves(p, board).length * 4;
        case KIND.MA:
            return getMoves(p, board).length * 3;
        default:
            return 0;
    }
}

/**
 * team 관점 평가값. positional=false 면 기물 점수 합만(기존 AI 평가와 같음).
 */
export function evaluate(pcs: JanggiPiece[], team: number, positional = false): number {
    const board = positional ? getBoard(pcs) : null;
    let score = 0;
    for (const p of pcs) {
        if (!p.alive) continue;
        let v = SCORES[p.kind];
        if (board) v += positionalScore(p, board, pcs);
        score += p.team === team ? v : -v;
    }
    return score;
}

class Searcher {
    pcs: JanggiPiece[];
    board: Board;
    nodes = 0;
    private cfg: DifficultyConfig;
    private deadline: number;
    private now: () => number;

    constructor(pieces: JanggiPiece[], cfg: DifficultyConfig, deadline: number, now: () => number) {
        this.pcs = pieces.map((p) => ({ ...p }));
        this.board = getBoard(this.pcs);
        this.cfg = cfg;
        this.deadline = deadline;
        this.now = now;
    }

    genMoves(team: number): SearchMove[] {
        const out: SearchMove[] = [];
        for (let i = 0; i < this.pcs.length; i++) {
            const p = this.pcs[i];
            if (!p.alive || p.team !== team) continue;
            for (const to of getMoves(p, this.board)) {
                const victim = this.board[to.y][to.x];
                out.push({
                    index: i,
                    to,
                    order: this.cfg.ordering ? mvvLva(p.kind, victim ? victim.kind : null) : 0
                });
            }
        }
        if (this.cfg.ordering) out.sort((a, b) => b.order - a.order);
        return out;
    }

    make(m: SearchMove): { fx: number; fy: number; captured: JanggiPiece | null } {
        const p = this.pcs[m.index];
        const captured = this.board[m.to.y][m.to.x];
        if (captured) captured.alive = false;
        const fx = p.x;
        const fy = p.y;
        this.board[fy][fx] = null;
        p.x = m.to.x;
        p.y = m.to.y;
        this.board[p.y][p.x] = p;
        return { fx, fy, captured };
    }

    unmake(m: SearchMove, undo: { fx: number; fy: number; captured: JanggiPiece | null }) {
        const p = this.pcs[m.index];
        this.board[p.y][p.x] = undo.captured;
        if (undo.captured) undo.captured.alive = true;
        p.x = undo.fx;
        p.y = undo.fy;
        this.board[p.y][p.x] = p;
    }

    negamax(depth: number, alpha: number, beta: number, team: number, ply: number): number {
        this.nodes++;
        if ((this.nodes & 1023) === 0 && this.now() > this.deadline) throw ABORT;
        if (depth === 0) return evaluate(this.pcs, team, this.cfg.positional);
        const moves = this.genMoves(team);
        if (moves.length === 0) return -(MATE - ply);
        let best = -Infinity;
        for (const m of moves) {
            const undo = this.make(m);
            const val =
                undo.captured && undo.captured.kind === KIND.GUNG
                    ? MATE - ply - 1
                    : -this.negamax(depth - 1, -beta, -alpha, other(team), ply + 1);
            this.unmake(m, undo);
            if (val > best) best = val;
            if (val > alpha) alpha = val;
            if (alpha >= beta) break;
        }
        return best;
    }

    root(
        depth: number,
        team: number,
        pv: { index: number; to: Point } | null,
        random: () => number
    ): { move: SearchMove; score: number } | null {
        const moves = this.genMoves(team);
        if (moves.length === 0) return null;
        if (this.cfg.ordering && pv) {
            const at = moves.findIndex(
                (m) => m.index === pv.index && m.to.x === pv.to.x && m.to.y === pv.to.y
            );
            if (at > 0) moves.unshift(moves.splice(at, 1)[0]);
        }
        let alpha = -Infinity;
        let bestScore = -Infinity;
        let bestMove = moves[0];
        for (const m of moves) {
            const undo = this.make(m);
            const raw =
                undo.captured && undo.captured.kind === KIND.GUNG
                    ? MATE
                    : -this.negamax(depth - 1, -Infinity, -alpha, other(team), 1);
            this.unmake(m, undo);
            const val = this.cfg.noise > 0 ? raw + random() * this.cfg.noise : raw;
            if (val > bestScore) {
                bestScore = val;
                bestMove = m;
            }
            if (raw > alpha) alpha = raw;
        }
        return { move: bestMove, score: bestScore };
    }
}

/**
 * team 이 둘 최선수를 찾는다. 둘 수가 없으면 null.
 * 시간 상한을 넘기면 마지막으로 끝난 깊이의 결과를 돌려준다(첫 깊이는 상한과 무관하게 끝낸다).
 */
export function searchBestMove(
    pieces: JanggiPiece[],
    team: number,
    difficulty: Difficulty,
    opts: SearchOptions = {}
): SearchResult | null {
    const cfg = DIFFICULTY_CONFIG[isDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY];
    const now = opts.now ?? (() => Date.now());
    const random = opts.random ?? Math.random;
    const timeLimit = opts.timeLimitMs ?? THINK_TIME_LIMIT_MS;
    const maxDepth = Math.max(1, Math.min(cfg.maxDepth, opts.maxDepth ?? cfg.maxDepth));
    const deadline = now() + timeLimit;

    // 첫 깊이(1수)는 상한 없이 끝낸다 — 무조건 둘 수를 확보.
    const s = new Searcher(pieces, cfg, Infinity, now);
    const first = s.root(1, team, null, random);
    if (!first) return null;
    let best = first;
    let depthDone = 1;

    const deep = new Searcher(pieces, cfg, deadline, now);
    for (let d = 2; d <= maxDepth; d++) {
        if (Math.abs(best.score) >= MATE - 100) break; // 외통·궁 잡기 확정
        if (now() > deadline) break;
        try {
            const r = deep.root(d, team, { index: best.move.index, to: best.move.to }, random);
            if (!r) break;
            best = r;
            depthDone = d;
        } catch (e) {
            if (e === ABORT) break;
            throw e;
        }
    }

    const p = pieces[best.move.index];
    return {
        index: best.move.index,
        from: { x: p.x, y: p.y },
        to: { x: best.move.to.x, y: best.move.to.y },
        score: best.score,
        depth: depthDone,
        nodes: s.nodes + deep.nodes
    };
}

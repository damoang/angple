/**
 * 장기 규칙·배치 — AI 연습판과 온라인 대전 화면이 같이 쓰는 순수 함수 모음.
 *
 * 행마 규칙(getMoves 등)은 서버 규칙 엔진과 분기 구조가 1:1 로 맞춰져 있다.
 * 규칙을 고칠 때는 서버 쪽도 같이 고쳐야 한다(온라인 대전은 서버가 판정한다).
 *
 * 좌표: x∈[0,9) 왼쪽→오른쪽, y∈[0,10) 위→아래. 한(漢)=위(y 0~3), 초(楚)=아래(y 6~9).
 */

export const COLS = 9;
export const ROWS = 10;

/** 말 종류 — 서버 직렬화 값과 같다. */
export const KIND = { GUNG: 1, CHA: 2, SANG: 3, MA: 4, SA: 5, PO: 6, JOLE: 7 } as const;
/** 진영 — 초=1(아래), 한=2(위). */
export const TEAM = { CHO: 1, HAN: 2 } as const;

export type Kind = (typeof KIND)[keyof typeof KIND];
export type Team = (typeof TEAM)[keyof typeof TEAM];

export interface Point {
    x: number;
    y: number;
}

export interface JanggiPiece {
    kind: number;
    team: number;
    x: number;
    y: number;
    alive: boolean;
}

export type Board = (JanggiPiece | null)[][];

/** 기물 점수(평가용). */
export const SCORES: Record<number, number> = {
    [KIND.GUNG]: 20000,
    [KIND.CHA]: 1000,
    [KIND.SANG]: 450,
    [KIND.MA]: 700,
    [KIND.SA]: 600,
    [KIND.PO]: 850,
    [KIND.JOLE]: 400
};

/**
 * 상차림 4종. 이름은 **그 진영 사람이 자기 쪽에서 판을 바라본 왼쪽→오른쪽** 순서로
 * 차 다음 칸부터 읽는다(차·[1]·[2]·사·_·사·[3]·[4]·차 의 [1]~[4]).
 *
 * - 초(아래)는 판 x 순서와 자기 시점이 같다: [1]=x1, [2]=x2, [3]=x6, [4]=x7.
 * - 한(위)은 판을 반대편에서 보므로 좌우가 뒤집힌다: [1]=x7, [2]=x6, [3]=x2, [4]=x1.
 *
 * 예) 기존 고정 배치(초 x1~x7 = 象馬…象馬, 한도 판 x 기준 象馬…象馬)는
 *     초=상마상마, 한=마상마상(한 시점) 이다 — LEGACY_SETUP 참고.
 */
export const SETUPS = ['마상마상', '마상상마', '상마상마', '상마마상'] as const;
export type Setup = (typeof SETUPS)[number];

/** 상차림 → 자기 시점 [1]~[4] 칸의 기물. */
export const SETUP_LAYOUT: Record<Setup, [Kind, Kind, Kind, Kind]> = {
    마상마상: [KIND.MA, KIND.SANG, KIND.MA, KIND.SANG],
    마상상마: [KIND.MA, KIND.SANG, KIND.SANG, KIND.MA],
    상마상마: [KIND.SANG, KIND.MA, KIND.SANG, KIND.MA],
    상마마상: [KIND.SANG, KIND.MA, KIND.MA, KIND.SANG]
};

/** 상차림 이름(설명용). */
export const SETUP_LABEL: Record<Setup, string> = {
    마상마상: '오른상',
    마상상마: '안상',
    상마상마: '왼상',
    상마마상: '바깥상'
};

/** 기본 상차림(자기 시점). */
export const DEFAULT_SETUP: Setup = '상마상마';

/** 기존 고정 배치와 같은 결과를 내는 조합 — initPieces(cho, han) 인자. */
export const LEGACY_SETUP: { cho: Setup; han: Setup } = { cho: '상마상마', han: '마상마상' };

export function isSetup(v: unknown): v is Setup {
    return typeof v === 'string' && (SETUPS as readonly string[]).includes(v);
}

/** 상차림 [1]~[4] 칸이 판에서 몇 번째 x 인지 (진영 시점 반영). */
export function setupColumns(team: number): [number, number, number, number] {
    return team === TEAM.CHO ? [1, 2, 6, 7] : [7, 6, 2, 1];
}

function makePiece(kind: number, team: number, x: number, y: number): JanggiPiece {
    return { kind, team, x, y, alive: true };
}

/**
 * 초기 배치. 배열 순서는 기존과 같다(한 먼저: 차·[x1]·[x2]·사·사·[x6]·[x7]·차·궁·포·포·졸×5,
 * 그다음 초 같은 순서) — 서버 pieces 배열과 인덱스 호환.
 */
export function initPieces(
    choSetup: Setup = LEGACY_SETUP.cho,
    hanSetup: Setup = LEGACY_SETUP.han
): JanggiPiece[] {
    const p: JanggiPiece[] = [];
    const sides: Array<[number, Setup, number, number, number, number]> = [
        // team, setup, 뒷줄 y, 궁 y, 포 y, 졸 y
        [TEAM.HAN, hanSetup, 0, 1, 2, 3],
        [TEAM.CHO, choSetup, 9, 8, 7, 6]
    ];
    for (const [team, setup, backY, gungY, poY, joleY] of sides) {
        const cols = setupColumns(team);
        const kinds = SETUP_LAYOUT[setup] ?? SETUP_LAYOUT[DEFAULT_SETUP];
        const back: Record<number, number> = {};
        for (let i = 0; i < 4; i++) back[cols[i]] = kinds[i];
        p.push(makePiece(KIND.CHA, team, 0, backY));
        p.push(makePiece(back[1], team, 1, backY));
        p.push(makePiece(back[2], team, 2, backY));
        p.push(makePiece(KIND.SA, team, 3, backY));
        p.push(makePiece(KIND.SA, team, 5, backY));
        p.push(makePiece(back[6], team, 6, backY));
        p.push(makePiece(back[7], team, 7, backY));
        p.push(makePiece(KIND.CHA, team, 8, backY));
        p.push(makePiece(KIND.GUNG, team, 4, gungY));
        p.push(makePiece(KIND.PO, team, 1, poY));
        p.push(makePiece(KIND.PO, team, 7, poY));
        for (let i = 0; i < 5; i++) p.push(makePiece(KIND.JOLE, team, i * 2, joleY));
    }
    return p;
}

/** 말 목록 → 격자. b[y][x], 빈 칸은 null. */
export function getBoard(pcs: JanggiPiece[]): Board {
    const b: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (const p of pcs) {
        if (p.alive) b[p.y][p.x] = p;
    }
    return b;
}

/** (x,y)가 team 의 궁성 안인지. */
export function inPalace(x: number, y: number, team: number): boolean {
    if (x < 3 || x > 5) return false;
    if (team === TEAM.HAN) return y >= 0 && y <= 2;
    return y >= 7 && y <= 9;
}

/** 궁성 대각선 위 점인지 (네 모서리 + 중심). */
export function onPalaceDiag(x: number, y: number): boolean {
    if (x >= 3 && x <= 5 && y >= 0 && y <= 2) {
        return x - 3 === y || 5 - x === y;
    }
    if (x >= 3 && x <= 5 && y >= 7 && y <= 9) {
        return x - 3 === y - 7 || 5 - x === y - 7;
    }
    return false;
}

function palaceDiagOrCenter(x: number, y: number): boolean {
    return onPalaceDiag(x, y) || (x === 4 && (y === 1 || y === 8));
}

const ORTHO: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0]
];
const DIAG: ReadonlyArray<readonly [number, number]> = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
];
const MA_STEPS: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, -1, -1, -2],
    [0, -1, 1, -2],
    [0, 1, -1, 2],
    [0, 1, 1, 2],
    [-1, 0, -2, -1],
    [-1, 0, -2, 1],
    [1, 0, 2, -1],
    [1, 0, 2, 1]
];
const SANG_STEPS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
    [0, -1, -1, -2, -2, -3],
    [0, -1, 1, -2, 2, -3],
    [0, 1, -1, 2, -2, 3],
    [0, 1, 1, 2, 2, 3],
    [-1, 0, -2, -1, -3, -2],
    [-1, 0, -2, 1, -3, 2],
    [1, 0, 2, -1, 3, -2],
    [1, 0, 2, 1, 3, 2]
];

function onBoard(x: number, y: number): boolean {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

/**
 * 말 하나의 의사 합법수(자기 궁 장군 방치 여부는 보지 않는다).
 * 분기 구조는 서버 규칙 엔진과 1:1.
 */
export function getMoves(piece: JanggiPiece, board: Board): Point[] {
    const moves: Point[] = [];
    const { kind, x, y, team } = piece;

    function addIf(nx: number, ny: number) {
        if (!onBoard(nx, ny)) return;
        const target = board[ny][nx];
        if (target && target.team === team) return;
        moves.push({ x: nx, y: ny });
    }

    if (kind === KIND.GUNG || kind === KIND.SA) {
        const dirs: Array<readonly [number, number]> = [...ORTHO];
        if (onPalaceDiag(x, y)) dirs.push(...DIAG);
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (inPalace(nx, ny, team)) addIf(nx, ny);
        }
    } else if (kind === KIND.CHA) {
        for (const [dx, dy] of ORTHO) {
            let nx = x + dx;
            let ny = y + dy;
            while (onBoard(nx, ny)) {
                const target = board[ny][nx];
                if (target) {
                    if (target.team !== team) moves.push({ x: nx, y: ny });
                    break;
                }
                moves.push({ x: nx, y: ny });
                nx += dx;
                ny += dy;
            }
        }
        if (onPalaceDiag(x, y)) {
            for (const [dx, dy] of DIAG) {
                let nx = x + dx;
                let ny = y + dy;
                while (onBoard(nx, ny)) {
                    if (!palaceDiagOrCenter(nx, ny)) break;
                    const target = board[ny][nx];
                    if (target) {
                        if (target.team !== team) moves.push({ x: nx, y: ny });
                        break;
                    }
                    moves.push({ x: nx, y: ny });
                    nx += dx;
                    ny += dy;
                }
            }
        }
    } else if (kind === KIND.MA) {
        for (const [bx, by, tx, ty] of MA_STEPS) {
            const blockX = x + bx;
            const blockY = y + by;
            if (!onBoard(blockX, blockY)) continue;
            if (board[blockY][blockX]) continue; // 멱 막힘
            addIf(x + tx, y + ty);
        }
    } else if (kind === KIND.SANG) {
        for (const [b1x, b1y, b2x, b2y, tx, ty] of SANG_STEPS) {
            const bx1 = x + b1x;
            const by1 = y + b1y;
            const bx2 = x + b2x;
            const by2 = y + b2y;
            if (!onBoard(bx1, by1) || !onBoard(bx2, by2)) continue;
            if (board[by1][bx1] || board[by2][bx2]) continue;
            addIf(x + tx, y + ty);
        }
    } else if (kind === KIND.PO) {
        for (const [dx, dy] of ORTHO) {
            let nx = x + dx;
            let ny = y + dy;
            let jumped = false;
            while (onBoard(nx, ny)) {
                const target = board[ny][nx];
                if (!jumped) {
                    if (target) {
                        if (target.kind === KIND.PO) break; // 포는 포를 못 넘는다
                        jumped = true;
                    }
                } else {
                    if (target) {
                        if (target.team !== team && target.kind !== KIND.PO) {
                            moves.push({ x: nx, y: ny });
                        }
                        break;
                    }
                    moves.push({ x: nx, y: ny });
                }
                nx += dx;
                ny += dy;
            }
        }
        if (onPalaceDiag(x, y)) {
            for (const [dx, dy] of DIAG) {
                const mx = x + dx;
                const my = y + dy;
                const tx = x + dx * 2;
                const ty = y + dy * 2;
                if (!onBoard(mx, my) || !onBoard(tx, ty)) continue;
                if (!palaceDiagOrCenter(mx, my) || !palaceDiagOrCenter(tx, ty)) continue;
                const mid = board[my][mx];
                if (!mid || mid.kind === KIND.PO) continue;
                const target = board[ty][tx];
                if (!target) moves.push({ x: tx, y: ty });
                else if (target.team !== team && target.kind !== KIND.PO) {
                    moves.push({ x: tx, y: ty });
                }
            }
        }
    } else if (kind === KIND.JOLE) {
        const forward = team === TEAM.CHO ? -1 : 1;
        addIf(x, y + forward);
        addIf(x - 1, y);
        addIf(x + 1, y);
        if (onPalaceDiag(x, y)) {
            addIf(x - 1, y + forward);
            addIf(x + 1, y + forward);
        }
    }

    return moves;
}

/** team 의 궁이 공격받고 있는지. 궁이 없으면 true. */
export function isCheck(pcs: JanggiPiece[], targetTeam: number): boolean {
    const board = getBoard(pcs);
    const king = pcs.find((p) => p.alive && p.kind === KIND.GUNG && p.team === targetTeam);
    if (!king) return true;
    for (const p of pcs) {
        if (!p.alive || p.team === targetTeam) continue;
        if (getMoves(p, board).some((m) => m.x === king.x && m.y === king.y)) return true;
    }
    return false;
}

export interface MoveCandidate {
    /** pcs 배열 인덱스 */
    index: number;
    from: Point;
    to: Point;
}

/** team 의 의사 합법수 전부. */
export function getAllMoves(pcs: JanggiPiece[], team: number): MoveCandidate[] {
    const board = getBoard(pcs);
    const result: MoveCandidate[] = [];
    pcs.forEach((p, index) => {
        if (!p.alive || p.team !== team) return;
        for (const m of getMoves(p, board)) {
            result.push({ index, from: { x: p.x, y: p.y }, to: m });
        }
    });
    return result;
}

/** 복사본에 수를 둔다. 도착 칸의 상대 말은 잡힌다. 원본 불변. */
export function applyMove(pcs: JanggiPiece[], index: number, to: Point): JanggiPiece[] {
    const mover = pcs[index];
    return pcs.map((p, i) => {
        if (i === index) return { ...p, x: to.x, y: to.y };
        if (p.alive && p.x === to.x && p.y === to.y && p.team !== mover.team) {
            return { ...p, alive: false };
        }
        return { ...p };
    });
}

/** 두고 나서 자기 궁이 장군이 아닌 수만 (서버 LegalMoves 와 같은 기준). */
export function legalTargets(pcs: JanggiPiece[], index: number): Point[] {
    const p = pcs[index];
    if (!p || !p.alive) return [];
    const board = getBoard(pcs);
    return getMoves(p, board).filter((m) => !isCheck(applyMove(pcs, index, m), p.team));
}

/** 표시용 글자 — [한자, 한글]. 궁은 진영 글자. */
export function pieceGlyph(kind: number, team: number): [string, string] {
    switch (kind) {
        case KIND.GUNG:
            return team === TEAM.CHO ? ['楚', '초'] : ['漢', '한'];
        case KIND.CHA:
            return ['車', '차'];
        case KIND.SANG:
            return ['象', '상'];
        case KIND.MA:
            return ['馬', '마'];
        case KIND.SA:
            return ['士', '사'];
        case KIND.PO:
            return ['包', '포'];
        case KIND.JOLE:
            return team === TEAM.CHO ? ['卒', '졸'] : ['兵', '병'];
        default:
            return ['?', '?'];
    }
}

/** 기물 크기 등급: 3=궁, 2=차·포·마·상, 1=사·졸. */
export function pieceRank(kind: number): 1 | 2 | 3 {
    if (kind === KIND.GUNG) return 3;
    if (kind === KIND.SA || kind === KIND.JOLE) return 1;
    return 2;
}

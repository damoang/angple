/**
 * 먹은 말 — 말은 배열에서 지워지지 않고 alive:false 가 되므로 죽은 말 = 잡힌 말이다.
 *
 * 잡은 순서는 직전 국면과 비교(alive 변화)로 쌓는다. 비교할 수 없을 때(새 판·재접속·복원)는
 * 점수 큰 순(차·포·마·상·사·졸)으로 다시 세운다.
 */
import { KIND, TEAM, type JanggiPiece } from './rules';

/** 점수제 판정 점수(서버 점수 판정과 같은 값) — 궁은 0. 한 덤 1.5 는 여기 넣지 않는다. */
export const PIECE_POINTS: Record<number, number> = {
    [KIND.CHA]: 13,
    [KIND.PO]: 7,
    [KIND.MA]: 5,
    [KIND.SANG]: 3,
    [KIND.SA]: 3,
    [KIND.JOLE]: 2,
    [KIND.GUNG]: 0
};

/** 한 덤 — 점수 판정 표기용. */
export const HAN_BONUS = 1.5;

/** 재정렬 기준: 차·포·마·상·사·졸·궁. */
const KIND_ORDER: number[] = [KIND.CHA, KIND.PO, KIND.MA, KIND.SANG, KIND.SA, KIND.JOLE, KIND.GUNG];

function kindRank(kind: number): number {
    const i = KIND_ORDER.indexOf(kind);
    return i < 0 ? KIND_ORDER.length : i;
}

/** 죽은 말 인덱스를 점수 큰 순(같으면 배열 순)으로. */
export function fallbackOrder(pieces: JanggiPiece[]): number[] {
    const dead: number[] = [];
    pieces.forEach((p, i) => {
        if (!p.alive) dead.push(i);
    });
    return dead.sort((a, b) => kindRank(pieces[a].kind) - kindRank(pieces[b].kind) || a - b);
}

function sameRoster(a: JanggiPiece[], b: JanggiPiece[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].kind !== b[i].kind || a[i].team !== b[i].team) return false;
    }
    return true;
}

/**
 * 잡힌 순서(pieces 인덱스 목록)를 다음 국면에 맞춘다.
 * - 이전 순서는 그대로 두고 이번에 새로 죽은 말을 뒤에 붙인다.
 * - 이전 국면이 없거나, 말 구성이 다르거나, 되살아난 말·몰래 죽은 말이 있으면 다시 세운다.
 */
export function nextCaptureOrder(
    order: readonly number[],
    prev: JanggiPiece[] | null | undefined,
    next: JanggiPiece[]
): number[] {
    if (!prev || !sameRoster(prev, next)) return fallbackOrder(next);
    const kept = order.filter((i) => next[i] && !next[i].alive);
    if (kept.length !== order.length) return fallbackOrder(next);
    const known = new Set(kept);
    const fresh: number[] = [];
    for (let i = 0; i < next.length; i++) {
        if (next[i].alive || known.has(i)) continue;
        if (!prev[i].alive) return fallbackOrder(next); // 추적 밖에서 죽은 말 — 다시 세운다
        fresh.push(i);
    }
    fresh.sort((a, b) => kindRank(next[a].kind) - kindRank(next[b].kind) || a - b);
    return [...kept, ...fresh];
}

/** capturer 진영이 잡은 상대 말 — 잡은 순서대로. */
export function capturedBy(
    pieces: JanggiPiece[],
    order: readonly number[],
    capturer: number
): JanggiPiece[] {
    const out: JanggiPiece[] = [];
    for (const i of order) {
        const p = pieces[i];
        if (p && !p.alive && p.team !== capturer) out.push(p);
    }
    return out;
}

/** 잡은 말 점수 합. */
export function capturedPoints(list: readonly JanggiPiece[]): number {
    return list.reduce((sum, p) => sum + (PIECE_POINTS[p.kind] ?? 0), 0);
}

export interface CapturedGroup {
    kind: number;
    team: number;
    count: number;
}

/** 같은 종류끼리 묶는다(겹쳐 쌓기용). 묶음 순서 = 그 종류를 처음 잡은 순서. */
export function groupCaptured(list: readonly JanggiPiece[]): CapturedGroup[] {
    const groups: CapturedGroup[] = [];
    for (const p of list) {
        const g = groups.find((x) => x.kind === p.kind && x.team === p.team);
        if (g) g.count++;
        else groups.push({ kind: p.kind, team: p.team, count: 1 });
    }
    return groups;
}

/** 판 위에 남은 말 점수(점수 판정 표기용). 한은 덤 포함. */
export function boardScore(pieces: JanggiPiece[], team: number): number {
    let sum = 0;
    for (const p of pieces) {
        if (p.alive && p.team === team) sum += PIECE_POINTS[p.kind] ?? 0;
    }
    return team === TEAM.HAN ? sum + HAN_BONUS : sum;
}

/**
 * 장기 AI 테스트 — 난이도별 깊이, 둔 수의 합법성, 잡는 수·궁 잡기, 시간 상한
 */
import { describe, it, expect } from 'vitest';
import {
    DIFFICULTIES,
    DIFFICULTY_CONFIG,
    DIFFICULTY_LABEL,
    evaluate,
    isDifficulty,
    mvvLva,
    searchBestMove,
    type SearchResult
} from './ai';
import { KIND, TEAM, applyMove, getAllMoves, initPieces, type JanggiPiece } from './rules';

const { GUNG, CHA, SA, JOLE } = KIND;
const { CHO, HAN } = TEAM;

/** 결정적 난수(LCG) */
function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function isLegal(pcs: JanggiPiece[], team: number, r: SearchResult | null): boolean {
    if (!r) return false;
    const p = pcs[r.index];
    if (!p || !p.alive || p.team !== team) return false;
    if (p.x !== r.from.x || p.y !== r.from.y) return false;
    return getAllMoves(pcs, team).some(
        (m) => m.index === r.index && m.to.x === r.to.x && m.to.y === r.to.y
    );
}

describe('난이도 설정', () => {
    it('세 단계 라벨', () => {
        expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard']);
        expect(DIFFICULTIES.map((d) => DIFFICULTY_LABEL[d])).toEqual(['초급', '중급', '고급']);
    });

    it('깊이: 초급 1 < 중급 3(기존 AI) < 고급 5', () => {
        expect(DIFFICULTY_CONFIG.easy.maxDepth).toBe(1);
        expect(DIFFICULTY_CONFIG.normal.maxDepth).toBe(3);
        expect(DIFFICULTY_CONFIG.hard.maxDepth).toBe(5);
        expect(DIFFICULTY_CONFIG.hard.maxDepth).toBeGreaterThan(DIFFICULTY_CONFIG.normal.maxDepth);
        expect(DIFFICULTY_CONFIG.normal.maxDepth).toBeGreaterThan(DIFFICULTY_CONFIG.easy.maxDepth);
    });

    it('초급만 무작위, 고급만 정렬·위치 평가', () => {
        expect(DIFFICULTY_CONFIG.easy.noise).toBeGreaterThan(0);
        expect(DIFFICULTY_CONFIG.normal.noise).toBe(0);
        expect(DIFFICULTY_CONFIG.hard.noise).toBe(0);
        expect(DIFFICULTY_CONFIG.hard.ordering).toBe(true);
        expect(DIFFICULTY_CONFIG.hard.positional).toBe(true);
        expect(DIFFICULTY_CONFIG.normal.ordering).toBe(false);
        expect(DIFFICULTY_CONFIG.normal.positional).toBe(false);
    });

    it('isDifficulty', () => {
        expect(isDifficulty('hard')).toBe(true);
        expect(isDifficulty('expert')).toBe(false);
        expect(isDifficulty(null)).toBe(false);
    });
});

describe('평가·정렬', () => {
    it('대칭 배치는 0점(기물·위치 평가 모두)', () => {
        const pcs = initPieces();
        expect(evaluate(pcs, CHO)).toBe(0);
        expect(evaluate(pcs, HAN, true)).toBe(0);
    });

    it('기물을 잃으면 그 진영 점수가 내려간다', () => {
        const pcs = initPieces();
        const chaIdx = pcs.findIndex((p) => p.team === CHO && p.kind === CHA);
        const lost = pcs.map((p, i) => (i === chaIdx ? { ...p, alive: false } : p));
        expect(evaluate(lost, CHO)).toBeLessThan(0);
        expect(evaluate(lost, HAN)).toBeGreaterThan(0);
    });

    it('MVV-LVA — 싼 말로 비싼 말 잡기가 먼저', () => {
        expect(mvvLva(JOLE, CHA)).toBeGreaterThan(mvvLva(CHA, CHA));
        expect(mvvLva(CHA, CHA)).toBeGreaterThan(mvvLva(CHA, JOLE));
        expect(mvvLva(CHA, JOLE)).toBeGreaterThan(0);
        expect(mvvLva(CHA, null)).toBe(0);
    });
});

describe('searchBestMove — 합법성', () => {
    it('첫 수: 모든 난이도가 합법수를 둔다', () => {
        const pcs = initPieces('상마마상', '마상상마');
        for (const d of DIFFICULTIES) {
            const r = searchBestMove(pcs, HAN, d, {
                random: seeded(1),
                maxDepth: d === 'hard' ? 2 : undefined
            });
            expect(isLegal(pcs, HAN, r)).toBe(true);
        }
    });

    it('초급끼리 20수를 두는 동안 매 수가 합법', () => {
        let pcs = initPieces();
        let team: number = CHO;
        const rnd = seeded(42);
        for (let ply = 0; ply < 20; ply++) {
            const r = searchBestMove(pcs, team, 'easy', { random: rnd });
            if (!r) break;
            expect(isLegal(pcs, team, r)).toBe(true);
            pcs = applyMove(pcs, r.index, r.to);
            if (!pcs.some((p) => p.alive && p.kind === GUNG && p.team !== team)) break;
            team = team === CHO ? HAN : CHO;
        }
    });

    it('중급·고급 수는 탐색 깊이를 보고한다', () => {
        const pcs = initPieces();
        const normal = searchBestMove(pcs, HAN, 'normal', { random: seeded(3) });
        expect(normal?.depth).toBe(3);
        const hard = searchBestMove(pcs, HAN, 'hard', { random: seeded(3), maxDepth: 2 });
        expect(hard?.depth).toBe(2);
    });

    it('둘 수가 없으면 null', () => {
        const pcs: JanggiPiece[] = [{ kind: GUNG, team: CHO, x: 4, y: 8, alive: true }];
        expect(searchBestMove(pcs, HAN, 'normal')).toBeNull();
    });
});

describe('searchBestMove — 판단', () => {
    // 한 차가 지키는 사람 없는 초 차를 잡을 수 있다
    const hanging: JanggiPiece[] = [
        { kind: GUNG, team: HAN, x: 4, y: 1, alive: true },
        { kind: GUNG, team: CHO, x: 4, y: 8, alive: true },
        { kind: CHA, team: HAN, x: 0, y: 0, alive: true },
        { kind: CHA, team: CHO, x: 0, y: 5, alive: true },
        { kind: SA, team: CHO, x: 4, y: 9, alive: true }
    ];

    for (const d of ['normal', 'hard'] as const) {
        it(`${d}: 공짜 차를 잡는다`, () => {
            const r = searchBestMove(hanging, HAN, d, { random: seeded(7), maxDepth: 3 });
            expect(r?.index).toBe(2);
            expect(r?.to).toEqual({ x: 0, y: 5 });
        });
    }

    it('초급(무작위 0): 공짜 차를 잡는다', () => {
        const r = searchBestMove(hanging, HAN, 'easy', { random: () => 0 });
        expect(r?.to).toEqual({ x: 0, y: 5 });
    });

    it('궁을 잡을 수 있으면 잡는다', () => {
        const pcs: JanggiPiece[] = [
            { kind: GUNG, team: HAN, x: 3, y: 0, alive: true },
            { kind: GUNG, team: CHO, x: 4, y: 8, alive: true },
            { kind: CHA, team: HAN, x: 4, y: 3, alive: true },
            { kind: CHA, team: CHO, x: 0, y: 9, alive: true }
        ];
        for (const d of DIFFICULTIES) {
            const r = searchBestMove(pcs, HAN, d, { random: () => 0 });
            expect(r?.to).toEqual({ x: 4, y: 8 });
        }
    });
});

describe('searchBestMove — 시간 상한', () => {
    it('상한을 넘기면 끝난 깊이까지의 합법수를 돌려준다', () => {
        let t = 0;
        const now = () => (t += 1000);
        const pcs = initPieces();
        const r = searchBestMove(pcs, HAN, 'hard', { now, timeLimitMs: 3000 });
        expect(isLegal(pcs, HAN, r)).toBe(true);
        expect(r!.depth).toBeGreaterThanOrEqual(1);
        expect(r!.depth).toBeLessThan(DIFFICULTY_CONFIG.hard.maxDepth);
    });
});

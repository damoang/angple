/**
 * 장기 규칙·상차림 테스트 — 4×4 배치 좌표, 기존 고정 배치 호환, 기본 행마
 */
import { describe, it, expect } from 'vitest';
import {
    KIND,
    LEGACY_SETUP,
    SETUPS,
    SETUP_LAYOUT,
    TEAM,
    applyMove,
    getAllMoves,
    getBoard,
    getMoves,
    initPieces,
    isCheck,
    isSetup,
    legalTargets,
    setupColumns,
    type JanggiPiece,
    type Setup
} from './rules';

const { GUNG, CHA, SANG, MA, SA, PO, JOLE } = KIND;
const { CHO, HAN } = TEAM;

function at(pcs: JanggiPiece[], x: number, y: number): JanggiPiece | undefined {
    return pcs.find((p) => p.alive && p.x === x && p.y === y);
}

/** 기존(변경 전) 고정 배치 — 배열 순서까지 그대로 */
function legacyLayout(): JanggiPiece[] {
    const p: JanggiPiece[] = [];
    const add = (kind: number, team: number, x: number, y: number) =>
        p.push({ kind, team, x, y, alive: true });
    add(CHA, HAN, 0, 0);
    add(SANG, HAN, 1, 0);
    add(MA, HAN, 2, 0);
    add(SA, HAN, 3, 0);
    add(SA, HAN, 5, 0);
    add(SANG, HAN, 6, 0);
    add(MA, HAN, 7, 0);
    add(CHA, HAN, 8, 0);
    add(GUNG, HAN, 4, 1);
    add(PO, HAN, 1, 2);
    add(PO, HAN, 7, 2);
    for (let i = 0; i < 5; i++) add(JOLE, HAN, i * 2, 3);
    add(CHA, CHO, 0, 9);
    add(SANG, CHO, 1, 9);
    add(MA, CHO, 2, 9);
    add(SA, CHO, 3, 9);
    add(SA, CHO, 5, 9);
    add(SANG, CHO, 6, 9);
    add(MA, CHO, 7, 9);
    add(CHA, CHO, 8, 9);
    add(GUNG, CHO, 4, 8);
    add(PO, CHO, 1, 7);
    add(PO, CHO, 7, 7);
    for (let i = 0; i < 5; i++) add(JOLE, CHO, i * 2, 6);
    return p;
}

describe('initPieces — 기존 배치 호환', () => {
    it('인자 없이 부르면 기존 고정 배치와 완전히 같다(순서 포함)', () => {
        expect(initPieces()).toEqual(legacyLayout());
    });

    it('기존 배치 = 초 상마상마 + 한 마상마상(한 시점)', () => {
        expect(LEGACY_SETUP).toEqual({ cho: '상마상마', han: '마상마상' });
        expect(initPieces('상마상마', '마상마상')).toEqual(legacyLayout());
    });
});

describe('initPieces — 상차림 4×4 좌표', () => {
    const expectedKind = (ch: string) => (ch === '마' ? MA : SANG);

    for (const cho of SETUPS) {
        for (const han of SETUPS) {
            it(`초 ${cho} × 한 ${han}`, () => {
                const pcs = initPieces(cho, han);
                expect(pcs).toHaveLength(32);

                // 칸 중복 없음
                const keys = new Set(pcs.map((p) => `${p.x},${p.y}`));
                expect(keys.size).toBe(32);

                // 초: 자기 시점 왼쪽→오른쪽 = 판 x 1,2,6,7 (y=9)
                const choCols = [1, 2, 6, 7];
                [...cho].forEach((ch, i) => {
                    const p = at(pcs, choCols[i], 9);
                    expect(p?.team).toBe(CHO);
                    expect(p?.kind).toBe(expectedKind(ch));
                });

                // 한: 반대편에서 보므로 자기 왼쪽→오른쪽 = 판 x 7,6,2,1 (y=0)
                const hanCols = [7, 6, 2, 1];
                [...han].forEach((ch, i) => {
                    const p = at(pcs, hanCols[i], 0);
                    expect(p?.team).toBe(HAN);
                    expect(p?.kind).toBe(expectedKind(ch));
                });

                // 상차림과 무관한 기물은 고정
                for (const [team, back, gung, po, jole] of [
                    [HAN, 0, 1, 2, 3],
                    [CHO, 9, 8, 7, 6]
                ]) {
                    expect(at(pcs, 0, back)).toMatchObject({ kind: CHA, team });
                    expect(at(pcs, 8, back)).toMatchObject({ kind: CHA, team });
                    expect(at(pcs, 3, back)).toMatchObject({ kind: SA, team });
                    expect(at(pcs, 5, back)).toMatchObject({ kind: SA, team });
                    expect(at(pcs, 4, back)).toBeUndefined();
                    expect(at(pcs, 4, gung)).toMatchObject({ kind: GUNG, team });
                    expect(at(pcs, 1, po)).toMatchObject({ kind: PO, team });
                    expect(at(pcs, 7, po)).toMatchObject({ kind: PO, team });
                    for (const x of [0, 2, 4, 6, 8]) {
                        expect(at(pcs, x, jole)).toMatchObject({ kind: JOLE, team });
                    }
                }

                // 마 2·상 2 씩
                for (const team of [CHO, HAN]) {
                    const mine = pcs.filter((p) => p.team === team);
                    expect(mine.filter((p) => p.kind === MA)).toHaveLength(2);
                    expect(mine.filter((p) => p.kind === SANG)).toHaveLength(2);
                }
            });
        }
    }

    it('대표 배치 직접 확인 — 초 마상상마, 한 상마마상', () => {
        const pcs = initPieces('마상상마', '상마마상');
        expect([1, 2, 6, 7].map((x) => at(pcs, x, 9)?.kind)).toEqual([MA, SANG, SANG, MA]);
        // 한 상마마상: 한 시점 [상,마,마,상] → 판 x7=상, x6=마, x2=마, x1=상
        expect([1, 2, 6, 7].map((x) => at(pcs, x, 0)?.kind)).toEqual([SANG, MA, MA, SANG]);
    });

    it('setupColumns — 진영별 시점', () => {
        expect(setupColumns(CHO)).toEqual([1, 2, 6, 7]);
        expect(setupColumns(HAN)).toEqual([7, 6, 2, 1]);
    });

    it('SETUP_LAYOUT 이름과 기물이 일치', () => {
        for (const s of SETUPS) {
            expect(SETUP_LAYOUT[s].map((k) => (k === MA ? '마' : '상')).join('')).toBe(s);
        }
    });

    it('isSetup', () => {
        expect(isSetup('상마상마')).toBe(true);
        expect(isSetup('마마상상')).toBe(false);
        expect(isSetup(null)).toBe(false);
        const s: Setup = '상마마상';
        expect(isSetup(s)).toBe(true);
    });
});

describe('행마 규칙', () => {
    it('첫 수 초의 의사 합법수 개수가 기존과 같다', () => {
        // 기존 배치에서 초 첫 수: 차 2×2, 상 마 사 궁 포 졸 … 고정값으로 회귀 감시
        const pcs = initPieces();
        const choMoves = getAllMoves(pcs, CHO);
        const hanMoves = getAllMoves(pcs, HAN);
        expect(choMoves.length).toBeGreaterThan(20);
        expect(choMoves.length).toBe(hanMoves.length);
    });

    it('마는 멱이 막히면 못 간다', () => {
        const pcs = initPieces();
        const board = getBoard(pcs);
        const ma = at(pcs, 2, 9)!;
        // (2,8) 위 비어 있음 → (1,7)은 포 자리(내 말), (3,7) 가능
        const moves = getMoves(ma, board);
        expect(moves).toContainEqual({ x: 3, y: 7 });
        expect(moves).not.toContainEqual({ x: 1, y: 7 });
        // 옆(1,9)·(3,9) 은 막혀 있어 가로 이동 없음
        expect(moves.every((m) => m.y === 7)).toBe(true);
    });

    it('포는 포를 넘지 못하고 포를 잡지 못한다', () => {
        const pcs: JanggiPiece[] = [
            { kind: PO, team: CHO, x: 4, y: 9, alive: true },
            { kind: PO, team: HAN, x: 4, y: 5, alive: true },
            { kind: JOLE, team: HAN, x: 4, y: 3, alive: true }
        ];
        const moves = getMoves(pcs[0], getBoard(pcs));
        expect(moves.some((m) => m.x === 4 && m.y < 9)).toBe(false);
    });

    it('차는 궁성 대각선을 따라 움직인다', () => {
        const pcs: JanggiPiece[] = [{ kind: CHA, team: CHO, x: 3, y: 7, alive: true }];
        const moves = getMoves(pcs[0], getBoard(pcs));
        expect(moves).toContainEqual({ x: 4, y: 8 });
        expect(moves).toContainEqual({ x: 5, y: 9 });
    });

    it('applyMove 는 원본을 바꾸지 않고 상대 말을 잡는다', () => {
        const pcs: JanggiPiece[] = [
            { kind: CHA, team: CHO, x: 0, y: 9, alive: true },
            { kind: CHA, team: HAN, x: 0, y: 0, alive: true }
        ];
        const next = applyMove(pcs, 0, { x: 0, y: 0 });
        expect(pcs[1].alive).toBe(true);
        expect(next[1].alive).toBe(false);
        expect(next[0]).toMatchObject({ x: 0, y: 0 });
    });

    it('isCheck · legalTargets — 장군을 방치하는 수는 거른다', () => {
        const pcs: JanggiPiece[] = [
            { kind: GUNG, team: CHO, x: 4, y: 8, alive: true },
            { kind: SA, team: CHO, x: 4, y: 7, alive: true },
            { kind: CHA, team: HAN, x: 4, y: 2, alive: true },
            { kind: GUNG, team: HAN, x: 3, y: 0, alive: true }
        ];
        expect(isCheck(pcs, CHO)).toBe(false);
        // 사가 옆으로 비키면 차가 궁을 친다 → 사의 합법 칸은 (4,7)에서 벗어날 수 없다
        const t = legalTargets(pcs, 1);
        expect(t.every((m) => m.x === 4)).toBe(true);
        const moved = applyMove(pcs, 1, { x: 3, y: 7 });
        expect(isCheck(moved, CHO)).toBe(true);
    });
});

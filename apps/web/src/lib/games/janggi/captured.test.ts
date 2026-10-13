/**
 * 먹은 말 — 잡은 순서 추적, 재정렬(복원·재접속), 진영별 목록·점수·묶음
 */
import { describe, it, expect } from 'vitest';
import { KIND, SETUPS, TEAM, initPieces, type JanggiPiece } from './rules';
import {
    boardScore,
    capturedBy,
    capturedPoints,
    fallbackOrder,
    groupCaptured,
    nextCaptureOrder
} from './captured';

const { CHA, PO, MA, JOLE } = KIND;
const { CHO, HAN } = TEAM;

// initPieces 배열 순서: 한 0 차·1·2·3 사·4 사·5·6·7 차·8 궁·9 포·10 포·11~15 졸, 초는 +16
const HAN_CHA = 0;
const HAN_PO = 9;
const HAN_JOLE = 11;
const CHO_CHA = 16;
const CHO_JOLE = 27;

function kill(pcs: JanggiPiece[], ...idx: number[]): JanggiPiece[] {
    return pcs.map((p, i) => (idx.includes(i) ? { ...p, alive: false } : { ...p }));
}

describe('nextCaptureOrder — 잡은 순서', () => {
    it('새 판은 빈 목록', () => {
        expect(fallbackOrder(initPieces())).toEqual([]);
        expect(nextCaptureOrder([], null, initPieces())).toEqual([]);
    });

    it('수마다 새로 죽은 말을 뒤에 붙인다', () => {
        const p0 = initPieces();
        const p1 = kill(p0, HAN_JOLE);
        let order = nextCaptureOrder([], p0, p1);
        expect(order).toEqual([HAN_JOLE]);

        const p2 = kill(p1, CHO_CHA);
        order = nextCaptureOrder(order, p1, p2);
        expect(order).toEqual([HAN_JOLE, CHO_CHA]);

        const p3 = kill(p2, HAN_CHA);
        order = nextCaptureOrder(order, p2, p3);
        // 점수 큰 차가 나중에 잡혔으면 뒤에 — 시간 순서 유지
        expect(order).toEqual([HAN_JOLE, CHO_CHA, HAN_CHA]);

        // 아무것도 안 잡힌 수
        expect(
            nextCaptureOrder(
                order,
                p3,
                p3.map((p) => ({ ...p }))
            )
        ).toEqual(order);
    });

    it('한 번에 여러 개가 죽어 있으면 그 묶음만 점수 큰 순', () => {
        const p0 = initPieces();
        const p1 = kill(p0, HAN_JOLE);
        const p2 = kill(p1, CHO_JOLE, HAN_PO, HAN_CHA);
        expect(nextCaptureOrder([HAN_JOLE], p1, p2)).toEqual([HAN_JOLE, HAN_CHA, HAN_PO, CHO_JOLE]);
    });

    it('이전 국면이 없으면(재접속·복원) 점수 큰 순으로 다시 세운다', () => {
        const pcs = kill(initPieces(), HAN_JOLE, HAN_CHA, HAN_PO);
        expect(nextCaptureOrder([], null, pcs)).toEqual([HAN_CHA, HAN_PO, HAN_JOLE]);
        expect(fallbackOrder(pcs)).toEqual([HAN_CHA, HAN_PO, HAN_JOLE]);
    });

    it('되살아난 말(새 판)이 있으면 다시 세운다', () => {
        const dead = kill(initPieces(), HAN_JOLE);
        expect(nextCaptureOrder([HAN_JOLE], dead, initPieces())).toEqual([]);
    });

    it('추적 밖에서 이미 죽어 있던 말이 보이면 다시 세운다', () => {
        const prev = kill(initPieces(), HAN_JOLE, HAN_CHA);
        const next = kill(prev, HAN_PO);
        // order 에 HAN_CHA 가 빠져 있다(어긋남)
        expect(nextCaptureOrder([HAN_JOLE], prev, next)).toEqual([HAN_CHA, HAN_PO, HAN_JOLE]);
    });

    it('말 구성이 다르면(상차림이 다른 새 판) 다시 세운다', () => {
        const prev = kill(initPieces('상마상마', '마상마상'), HAN_JOLE);
        const next = kill(initPieces('마상마상', '마상마상'), CHO_JOLE);
        expect(nextCaptureOrder([HAN_JOLE], prev, next)).toEqual([CHO_JOLE]);
    });

    it('상차림 4종 모두 — 한의 마 두 개를 잡으면 초 줄에 마 2', () => {
        for (const setup of SETUPS) {
            const p0 = initPieces(setup, setup);
            const maIdx = p0
                .map((p, i) => (p.team === HAN && p.kind === MA ? i : -1))
                .filter((i) => i >= 0);
            expect(maIdx).toHaveLength(2);
            const p1 = kill(p0, maIdx[0]);
            const p2 = kill(p1, maIdx[1]);
            const order = nextCaptureOrder(nextCaptureOrder([], p0, p1), p1, p2);
            const list = capturedBy(p2, order, CHO);
            expect(list.map((p) => p.kind)).toEqual([MA, MA]);
            expect(capturedBy(p2, order, HAN)).toEqual([]);
            // 복원(이전 국면 없음)도 같은 결과
            expect(capturedBy(p2, fallbackOrder(p2), CHO).map((p) => p.kind)).toEqual([MA, MA]);
        }
    });
});

describe('capturedBy·capturedPoints·groupCaptured', () => {
    const pcs = kill(initPieces(), HAN_JOLE, CHO_CHA, HAN_CHA, HAN_JOLE + 1);
    const order = [HAN_JOLE, CHO_CHA, HAN_CHA, HAN_JOLE + 1];

    it('진영별로 상대 말만, 잡은 순서대로', () => {
        expect(capturedBy(pcs, order, CHO).map((p) => p.kind)).toEqual([JOLE, CHA, JOLE]);
        expect(capturedBy(pcs, order, HAN).map((p) => p.kind)).toEqual([CHA]);
    });

    it('점수 합 = 차13 포7 마5 상3 사3 졸2 (덤 없음)', () => {
        expect(capturedPoints(capturedBy(pcs, order, CHO))).toBe(17);
        expect(capturedPoints(capturedBy(pcs, order, HAN))).toBe(13);
        expect(capturedPoints([])).toBe(0);
        expect(capturedPoints([{ kind: PO, team: HAN, x: 0, y: 0, alive: false }])).toBe(7);
    });

    it('같은 종류는 한 묶음 — 묶음 순서는 처음 잡은 순서', () => {
        expect(groupCaptured(capturedBy(pcs, order, CHO))).toEqual([
            { kind: JOLE, team: HAN, count: 2 },
            { kind: CHA, team: HAN, count: 1 }
        ]);
    });
});

describe('boardScore — 점수 판정 표기', () => {
    it('처음 판: 초 72점, 한 72+1.5', () => {
        expect(boardScore(initPieces(), CHO)).toBe(72);
        expect(boardScore(initPieces(), HAN)).toBe(73.5);
    });

    it('죽은 말은 빠진다', () => {
        expect(boardScore(kill(initPieces(), CHO_CHA), CHO)).toBe(59);
    });
});

/**
 * 장군·멍군 알림 판정, 외통(장군 && 합법수 0) 판정
 */
import { describe, it, expect } from 'vitest';
import { KIND, TEAM, initPieces, type JanggiPiece } from './rules';
import { checkEvent, isCheckmate, otherTeam } from './check-events';

const { GUNG, CHA } = KIND;
const { CHO, HAN } = TEAM;

function piece(kind: number, team: number, x: number, y: number): JanggiPiece {
    return { kind, team, x, y, alive: true };
}

describe('checkEvent', () => {
    it('이번 수로 상대가 장군을 받으면 장군', () => {
        expect(checkEvent(null, CHO, HAN)).toBe('janggun');
        expect(checkEvent(null, HAN, CHO)).toBe('janggun');
    });

    it('장군 받던 진영이 수를 두어 피하면 멍군', () => {
        expect(checkEvent(HAN, HAN, null)).toBe('meonggun');
        expect(checkEvent(CHO, CHO, null)).toBe('meonggun');
    });

    it('피하면서 되받아 장군을 걸면 장군', () => {
        expect(checkEvent(HAN, HAN, CHO)).toBe('janggun');
    });

    it('평범한 수는 알림 없음', () => {
        expect(checkEvent(null, CHO, null)).toBeNull();
        // 장군 받던 쪽이 아닌 진영의 수(차례가 넘어가지 않은 경우 등)는 멍군 아님
        expect(checkEvent(HAN, CHO, null)).toBeNull();
    });

    it('외통 순간에는 장군·멍군 대신 알림 없음(끝 배너가 뜬다)', () => {
        expect(checkEvent(null, CHO, HAN, true)).toBeNull();
        expect(checkEvent(CHO, CHO, HAN, true)).toBeNull();
    });
});

describe('isCheckmate — 로컬 외통 판정', () => {
    // 한 궁(4,0) 하나만 남고, 초 차 셋이 x3·x4·x5 줄을 막는다
    function matePosition(): JanggiPiece[] {
        return [
            piece(GUNG, HAN, 4, 0),
            piece(GUNG, CHO, 4, 9),
            piece(CHA, CHO, 3, 5),
            piece(CHA, CHO, 4, 5),
            piece(CHA, CHO, 5, 5)
        ];
    }

    it('장군이고 피할 곳이 없으면 외통', () => {
        expect(isCheckmate(matePosition(), HAN)).toBe(true);
    });

    it('장군이지만 피할 곳이 있으면 외통 아님', () => {
        const pcs = matePosition().filter((p) => !(p.kind === CHA && p.x === 5));
        expect(isCheckmate(pcs, HAN)).toBe(false);
    });

    it('장군이 아니면 합법수가 적어도 외통 아님', () => {
        const pcs = matePosition().filter((p) => !(p.kind === CHA && p.x === 4));
        expect(isCheckmate(pcs, HAN)).toBe(false);
    });

    it('처음 판은 양쪽 모두 외통 아님', () => {
        expect(isCheckmate(initPieces(), CHO)).toBe(false);
        expect(isCheckmate(initPieces(), HAN)).toBe(false);
    });

    it('otherTeam', () => {
        expect(otherTeam(CHO)).toBe(HAN);
        expect(otherTeam(HAN)).toBe(CHO);
    });
});

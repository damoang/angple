import { describe, it, expect } from 'vitest';
import { simulateLadder, ladderWinners, ladderPath, type LadderData } from './ladder.js';

// 4열, 2레벨 사다리. gap 인덱스는 열 사이 간격(0=열0-열1).
// level0: gap0 rung → 열0↔1 스왑. level1: gap2 rung → 열2↔3 스왑.
const data: LadderData = {
    columns: 4,
    levels: 2,
    rungs: [
        [true, false, false],
        [false, false, true]
    ],
    win_slots: 2
};

describe('simulateLadder', () => {
    it('produces a bijection (permutation of columns)', () => {
        const end = simulateLadder(data);
        expect(end.length).toBe(4);
        expect([...end].sort()).toEqual([0, 1, 2, 3]);
    });

    it('applies rungs deterministically', () => {
        // start0 -> gap0 right -> col1 ; then no rung at level1 for col1 -> stays 1
        // start1 -> gap0 left -> col0 ; stays 0
        // start2 -> level0 none -> col2 ; level1 gap2 right -> col3
        // start3 -> level1 gap2 left -> col2
        expect(simulateLadder(data)).toEqual([1, 0, 3, 2]);
    });
});

describe('ladderWinners', () => {
    it('marks participants landing in the first win_slots columns', () => {
        const parts = ['p0', 'p1', 'p2', 'p3'];
        // end = [1,0,3,2] → cols <2 are winners: p0(→1), p1(→0)
        expect(ladderWinners(data, parts)).toEqual(['p0', 'p1']);
    });

    it('prefers server-provided end_col when present', () => {
        const withEnd = { ...data, end_col: [0, 1, 2, 3] };
        // identity end → winners are first 2 participants
        expect(ladderWinners(withEnd, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b']);
    });
});

describe('ladderPath', () => {
    it('returns the column at each level including the start', () => {
        expect(ladderPath(data, 2)).toEqual([2, 2, 3]);
    });
});

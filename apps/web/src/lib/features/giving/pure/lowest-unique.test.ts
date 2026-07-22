import { describe, it, expect } from 'vitest';
import { parseBidNumbers, lowestUniqueWinner, buildBidsByNumber } from './lowest-unique.js';

describe('parseBidNumbers', () => {
    it('parses single numbers, ranges (- and ~), dedups and sorts', () => {
        expect(parseBidNumbers('1,3,5')).toEqual([1, 3, 5]);
        expect(parseBidNumbers('5-8')).toEqual([5, 6, 7, 8]);
        expect(parseBidNumbers('15~17')).toEqual([15, 16, 17]);
        expect(parseBidNumbers('1,3,5-7,3')).toEqual([1, 3, 5, 6, 7]);
        expect(parseBidNumbers(' 4 , 2 ')).toEqual([2, 4]);
    });

    it('ignores all-zero and decimal tokens and reversed ranges', () => {
        expect(parseBidNumbers('0,00,2.5,3')).toEqual([3]);
        expect(parseBidNumbers('10-5')).toEqual([]);
        expect(parseBidNumbers('')).toEqual([]);
    });
});

describe('lowestUniqueWinner', () => {
    it('picks the bidder of the smallest number chosen by exactly one person', () => {
        const map = buildBidsByNumber([
            { mb_id: 'A', numbers: '1,2' },
            { mb_id: 'B', numbers: '1,3' }, // 1 duplicated
            { mb_id: 'C', numbers: '4' }
        ]);
        // 2 (A), 3 (B), 4 (C) are unique → smallest is 2 → A
        const r = lowestUniqueWinner(map);
        expect(r.hasWinner).toBe(true);
        expect(r.winningNumber).toBe(2);
        expect(r.winnerMbId).toBe('A');
    });

    it('returns no winner when every number is duplicated', () => {
        const map = buildBidsByNumber([
            { mb_id: 'A', numbers: '1,2' },
            { mb_id: 'B', numbers: '1,2' }
        ]);
        expect(lowestUniqueWinner(map).hasWinner).toBe(false);
    });

    it('handles empty board', () => {
        expect(lowestUniqueWinner(new Map()).hasWinner).toBe(false);
    });
});

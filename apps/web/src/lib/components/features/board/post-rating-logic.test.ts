import { describe, it, expect } from 'vitest';
import {
    RATING_MIN_LEVEL,
    clampRating,
    starFillPercent,
    applyOptimisticRating
} from './post-rating-logic';

describe('starFillPercent — 별 채움 계산', () => {
    it('avg 4.3 → 1~4번째 별 100%, 5번째 별 30%', () => {
        expect(starFillPercent(4.3, 1)).toBe(100);
        expect(starFillPercent(4.3, 2)).toBe(100);
        expect(starFillPercent(4.3, 3)).toBe(100);
        expect(starFillPercent(4.3, 4)).toBe(100);
        expect(starFillPercent(4.3, 5)).toBe(30);
    });

    it('avg 0 → 모든 별 0%', () => {
        for (const star of [1, 2, 3, 4, 5]) {
            expect(starFillPercent(0, star)).toBe(0);
        }
    });

    it('avg 5 → 모든 별 100%', () => {
        for (const star of [1, 2, 3, 4, 5]) {
            expect(starFillPercent(5, star)).toBe(100);
        }
    });

    it('경계: avg 2.5 → 3번째 별 50%, 4번째 별 0%', () => {
        expect(starFillPercent(2.5, 3)).toBe(50);
        expect(starFillPercent(2.5, 4)).toBe(0);
    });

    it('비정상 값(NaN/Infinity)은 0%', () => {
        expect(starFillPercent(NaN, 1)).toBe(0);
        expect(starFillPercent(Infinity, 1)).toBe(0);
    });
});

describe('clampRating — 별점 값 클램프', () => {
    it('1~5 범위로 클램프한다', () => {
        expect(clampRating(0)).toBe(1);
        expect(clampRating(3)).toBe(3);
        expect(clampRating(7)).toBe(5);
        expect(clampRating(NaN)).toBe(1);
    });
});

describe('applyOptimisticRating — 낙관적 갱신 + 롤백 안전성', () => {
    it('첫 투표: count+1, 평균 재계산', () => {
        // (4*2 + 1) / 3 = 3
        const next = applyOptimisticRating({ avg: 4, count: 2, my: 0 }, 1);
        expect(next).toEqual({ avg: 3, count: 3, my: 1 });
    });

    it('첫 투표: 참여 0명 글에 5점 → avg 5, count 1', () => {
        const next = applyOptimisticRating({ avg: 0, count: 0, my: 0 }, 5);
        expect(next).toEqual({ avg: 5, count: 1, my: 5 });
    });

    it('재투표: count 불변, 이전 내 별점을 빼고 새 별점을 더한다', () => {
        // 합계 8 → 8 - 3 + 5 = 10 → avg 5
        const next = applyOptimisticRating({ avg: 4, count: 2, my: 3 }, 5);
        expect(next).toEqual({ avg: 5, count: 2, my: 5 });
    });

    it('입력 객체를 변이하지 않는다 → 실패 시 이전 객체로 롤백 가능', () => {
        const prev = { avg: 4.5, count: 10, my: 0 };
        const snapshot = { ...prev };
        const optimistic = applyOptimisticRating(prev, 5);
        expect(prev).toEqual(snapshot); // 원본 그대로 = 롤백 대상 보존
        expect(optimistic).not.toBe(prev);
    });

    it('범위 밖 입력은 클램프해서 반영한다', () => {
        const next = applyOptimisticRating({ avg: 0, count: 0, my: 0 }, 9);
        expect(next.my).toBe(5);
    });
});

describe('RATING_MIN_LEVEL', () => {
    it('앙님💛 = mb_level 3 (as_level 아님)', () => {
        expect(RATING_MIN_LEVEL).toBe(3);
    });
});

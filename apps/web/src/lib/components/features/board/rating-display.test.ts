import { describe, it, expect } from 'vitest';
import {
    RATING_DISPLAY_MIN_COUNT,
    RATING_BAYESIAN_M,
    shouldShowAverage,
    formatRatingSummary,
    bayesianScore
} from './rating-display';

describe('shouldShowAverage — 평균 노출 임계(n>=3)', () => {
    it('n<3 이면 평균 숨김', () => {
        expect(shouldShowAverage(0)).toBe(false);
        expect(shouldShowAverage(1)).toBe(false);
        expect(shouldShowAverage(2)).toBe(false);
    });

    it('n>=3 이면 평균 노출', () => {
        expect(shouldShowAverage(RATING_DISPLAY_MIN_COUNT)).toBe(true);
        expect(shouldShowAverage(3)).toBe(true);
        expect(shouldShowAverage(100)).toBe(true);
    });

    it('비유한 수는 노출하지 않음', () => {
        expect(shouldShowAverage(Number.NaN)).toBe(false);
        // 무한대는 실제 참여수가 아니므로(비유한) 노출하지 않는다 — NaN 과 동일하게 안전측
        expect(shouldShowAverage(Number.POSITIVE_INFINITY)).toBe(false);
    });
});

describe('formatRatingSummary — n<3 착시 방지 문구', () => {
    it('참여 0 → 평가 없음', () => {
        expect(formatRatingSummary(0, 0)).toBe('아직 평가 없음');
        expect(formatRatingSummary(5, -1)).toBe('아직 평가 없음');
    });

    it('0<n<3 → 평균 숫자 미노출("앙님 N명 평가")', () => {
        expect(formatRatingSummary(5, 1)).toBe('앙님 1명 평가');
        expect(formatRatingSummary(4.8, 2)).toBe('앙님 2명 평가');
        // 평균이 아무리 높아도 숫자를 내세우지 않는다(핵심 규약)
        expect(formatRatingSummary(5, 2)).not.toContain('★');
    });

    it('n>=3 → 평균 + n 병기', () => {
        expect(formatRatingSummary(4.25, 3)).toBe('★4.3 · 앙님 3명');
        expect(formatRatingSummary(4.2, 100)).toBe('★4.2 · 앙님 100명');
    });

    it('큰 수는 천 단위 구분', () => {
        expect(formatRatingSummary(4.0, 1234)).toBe('★4.0 · 앙님 1,234명');
    });
});

describe('bayesianScore — 랭킹 보정(m=5, 전체평균으로 끌어당김)', () => {
    it('참여 적은 고평점은 전체평균 쪽으로 강하게 끌린다', () => {
        // v=1, avg=5, global=4, m=5 → (1/6)*5 + (5/6)*4 = 4.1666...
        expect(bayesianScore(5, 1, 4)).toBeCloseTo(25 / 6, 6);
    });

    it('참여가 많을수록 개별 평균에 수렴한다', () => {
        const few = bayesianScore(5, 1, 4);
        const many = bayesianScore(5, 100, 4);
        expect(many).toBeGreaterThan(few);
        // (100/105)*5 + (5/105)*4 = (500 + 20)/105 = 520/105 ≈ 4.952
        expect(many).toBeCloseTo(520 / 105, 6);
    });

    it('n=1 5.0 보정점 < n=100 4.2 보정점 (착시 역전 방지)', () => {
        const lonelyFive = bayesianScore(5, 1, 4);
        const popularFourTwo = bayesianScore(4.2, 100, 4);
        expect(lonelyFive).toBeLessThan(popularFourTwo);
    });

    it('참여 0 이면 전체평균을 그대로 반환', () => {
        expect(bayesianScore(0, 0, 3.7)).toBe(3.7);
    });

    it('기본 m 은 RATING_BAYESIAN_M(5)', () => {
        expect(bayesianScore(5, 5, 3)).toBe(bayesianScore(5, 5, 3, RATING_BAYESIAN_M));
    });
});

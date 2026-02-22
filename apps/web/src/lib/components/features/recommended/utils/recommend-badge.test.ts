import { describe, it, expect } from 'vitest';
import { getRecommendBadgeClass } from './recommend-badge';

describe('getRecommendBadgeClass', () => {
    it('0건 → 매우 연한 배경 + 연한 글자', () => {
        const cls = getRecommendBadgeClass(0);
        expect(cls).toContain('0.08');
        expect(cls).toContain('text-foreground/20');
    });

    it('1~15 → 회색 계열', () => {
        expect(getRecommendBadgeClass(1)).toContain('172,172,172');
        expect(getRecommendBadgeClass(15)).toContain('0.2');
    });

    it('16~25 → 연한 파란색', () => {
        expect(getRecommendBadgeClass(16)).toContain('59,130,246');
        expect(getRecommendBadgeClass(25)).toContain('0.3');
    });

    it('26~50 → 중간 파란색', () => {
        expect(getRecommendBadgeClass(26)).toContain('59,130,246');
        expect(getRecommendBadgeClass(50)).toContain('0.6');
    });

    it('51 이상 → 진한 파란색 + 흰 글자', () => {
        expect(getRecommendBadgeClass(51)).toContain('0,102,255');
        expect(getRecommendBadgeClass(51)).toContain('text-white');
        expect(getRecommendBadgeClass(100)).toContain('text-white');
    });
});

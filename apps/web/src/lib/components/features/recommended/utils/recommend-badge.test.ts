import { describe, it, expect } from 'vitest';
import { getRecommendBadgeClass } from './recommend-badge';

describe('getRecommendBadgeClass', () => {
    it('15 이하 → 파란색', () => {
        expect(getRecommendBadgeClass(0)).toContain('blue');
        expect(getRecommendBadgeClass(15)).toContain('blue');
    });

    it('16~25 → 보라색', () => {
        expect(getRecommendBadgeClass(16)).toContain('purple');
        expect(getRecommendBadgeClass(25)).toContain('purple');
    });

    it('26~50 → 핑크색', () => {
        expect(getRecommendBadgeClass(26)).toContain('pink');
        expect(getRecommendBadgeClass(50)).toContain('pink');
    });

    it('51 이상 → 빨간색', () => {
        expect(getRecommendBadgeClass(51)).toContain('red');
        expect(getRecommendBadgeClass(100)).toContain('red');
    });

    it('다크모드 클래스 포함', () => {
        expect(getRecommendBadgeClass(10)).toContain('dark:');
    });
});

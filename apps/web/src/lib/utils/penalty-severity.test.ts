import { describe, it, expect } from 'vitest';
import { penaltySeverity, SEVERITY_DOT, SEVERITY_TEXT, SEVERITY_BADGE } from './penalty-severity';

describe('penaltySeverity', () => {
    it('영구(-1)는 permanent', () => {
        expect(penaltySeverity(-1)).toBe('permanent');
    });

    it('주의(0)는 notice', () => {
        expect(penaltySeverity(0)).toBe('notice');
    });

    it('기간제(1 이상)는 active', () => {
        expect(penaltySeverity(1)).toBe('active');
        expect(penaltySeverity(5)).toBe('active');
        expect(penaltySeverity(365)).toBe('active');
    });

    it('기간이 만료되면 released', () => {
        expect(penaltySeverity(5, true)).toBe('released');
    });

    it('소명 인용 해제도 released — 만료 전이라도 효력이 없다', () => {
        expect(penaltySeverity(5, false, true)).toBe('released');
    });

    it('⛔ 영구도 소명 인용되면 released — 빨간 강도로 남으면 안 된다', () => {
        expect(penaltySeverity(-1, false, true)).toBe('released');
    });

    it('주의는 해제 개념이 없어도 released 플래그를 존중한다', () => {
        expect(penaltySeverity(0, true)).toBe('released');
    });
});

describe('강도별 색 테이블', () => {
    it('네 강도 모두 세 테이블에 값이 있다', () => {
        for (const sev of ['permanent', 'active', 'notice', 'released'] as const) {
            expect(SEVERITY_DOT[sev]).toBeTruthy();
            expect(SEVERITY_TEXT[sev]).toBeTruthy();
            expect(SEVERITY_BADGE[sev]).toBeTruthy();
        }
    });

    it('영구와 기간제는 서로 다른 색이어야 구분된다', () => {
        expect(SEVERITY_DOT.permanent).not.toBe(SEVERITY_DOT.active);
        expect(SEVERITY_TEXT.permanent).not.toBe(SEVERITY_TEXT.active);
        expect(SEVERITY_BADGE.permanent).not.toBe(SEVERITY_BADGE.active);
    });
});

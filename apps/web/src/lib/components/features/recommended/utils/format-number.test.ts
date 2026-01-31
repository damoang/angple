import { describe, it, expect } from 'vitest';
import { formatNumber } from './format-number';

describe('formatNumber', () => {
    it('1000 미만은 그대로 반환', () => {
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(1)).toBe('1');
        expect(formatNumber(999)).toBe('999');
    });

    it('1000 이상은 k 포맷', () => {
        expect(formatNumber(1000)).toBe('1.0k');
        expect(formatNumber(1500)).toBe('1.5k');
        expect(formatNumber(999999)).toBe('1000.0k');
    });

    it('1000000 이상은 m 포맷', () => {
        expect(formatNumber(1000000)).toBe('1.0m');
        expect(formatNumber(2500000)).toBe('2.5m');
    });

    it('1000000000 이상은 b 포맷', () => {
        expect(formatNumber(1000000000)).toBe('1.0b');
        expect(formatNumber(3000000000)).toBe('3.0b');
    });
});

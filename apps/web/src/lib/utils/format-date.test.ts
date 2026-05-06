import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { formatDate, formatDateCompact, isToday } from './format-date';

describe('format-date — Unix timestamp 보정', () => {
    // KST 2026-05-06 15:00 = UTC 06:00 (시각 자체는 무관, 단지 fake now 의 절대시점)
    const NOW = new Date('2026-05-06T06:00:00Z');
    const NOW_SEC = Math.floor(NOW.getTime() / 1000);
    const NOW_SEC_STR = String(NOW_SEC);
    const YESTERDAY_SEC = NOW_SEC - 86400;

    beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    it('10자리 Unix timestamp(초 단위) 문자열을 정상 파싱한다 — #12266', () => {
        const result = formatDate(NOW_SEC_STR);
        // 오늘이므로 HH:MM 형식 (KST 15:00)
        expect(result).toBe('15:00');
    });

    it('10자리 Unix timestamp 숫자도 동일하게 파싱한다', () => {
        const result = formatDate(NOW_SEC);
        expect(result).toBe('15:00');
    });

    it('ISO 문자열은 그대로 처리한다 (회귀 방지)', () => {
        const result = formatDate('2026-05-06T06:00:00Z');
        expect(result).toBe('15:00');
    });

    it('Gnuboard YYYYMMDD 8자리 형식은 그대로 변환된다 (회귀 방지)', () => {
        const result = formatDate('20260505');
        expect(result).toBe('05.05');
    });

    it('빈 값 / null / undefined 는 빈 문자열을 반환한다', () => {
        expect(formatDate('')).toBe('');
        expect(formatDate(null)).toBe('');
        expect(formatDate(undefined)).toBe('');
    });

    it('formatDateCompact 도 동일한 정규화 규칙을 적용한다', () => {
        expect(formatDateCompact(NOW_SEC_STR)).toBe('15:00');
        expect(formatDateCompact(NOW_SEC)).toBe('15:00');
    });

    it('isToday 가 unix timestamp 입력에서도 정확히 판정한다', () => {
        expect(isToday(NOW_SEC_STR)).toBe(true);
        expect(isToday(NOW_SEC)).toBe(true);
        expect(isToday(YESTERDAY_SEC)).toBe(false);
    });
});

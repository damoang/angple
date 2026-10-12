import { describe, it, expect } from 'vitest';
import { needsLoginTimestampUpdate, toKstDateString } from './login-day';

describe('toKstDateString', () => {
    it('Date 객체 → 그 순간의 KST 날짜', () => {
        // 2026-10-11T15:30Z = 2026-10-12 00:30 KST
        expect(toKstDateString(new Date('2026-10-11T15:30:00.000Z'))).toBe('2026-10-12');
        // 2026-10-12T14:59:59Z = 2026-10-12 23:59:59 KST
        expect(toKstDateString(new Date('2026-10-12T14:59:59.000Z'))).toBe('2026-10-12');
    });

    it('UTC ISO 문자열(캐시 JSON) → KST 날짜로 환산', () => {
        expect(toKstDateString('2026-10-11T15:30:00.000Z')).toBe('2026-10-12');
        expect(toKstDateString('2026-10-11T14:59:59.999Z')).toBe('2026-10-11');
    });

    it('시간대가 붙은 문자열 → 그 순간 기준', () => {
        expect(toKstDateString('2026-10-12T00:30:00+09:00')).toBe('2026-10-12');
        expect(toKstDateString('2026-10-11T23:30:00-01:00')).toBe('2026-10-12');
    });

    it('시간대 없는 DATETIME 문자열 → KST 벽시계 날짜 그대로', () => {
        expect(toKstDateString('2026-10-12 00:30:00')).toBe('2026-10-12');
        expect(toKstDateString('2026-10-12 23:59:59')).toBe('2026-10-12');
        expect(toKstDateString('2026-10-12')).toBe('2026-10-12');
    });

    it('null·빈 값·그누보드 0 날짜·잘못된 값 → null', () => {
        expect(toKstDateString(null)).toBeNull();
        expect(toKstDateString(undefined)).toBeNull();
        expect(toKstDateString('')).toBeNull();
        expect(toKstDateString('0000-00-00 00:00:00')).toBeNull();
        expect(toKstDateString('not a date')).toBeNull();
        expect(toKstDateString(new Date('invalid'))).toBeNull();
        expect(toKstDateString(12345)).toBeNull();
    });
});

describe('needsLoginTimestampUpdate', () => {
    // 2026-10-12 23:59 KST / 2026-10-13 00:00 KST
    const kst2359 = new Date('2026-10-12T14:59:00.000Z');
    const kst0000 = new Date('2026-10-12T15:00:00.000Z');

    it('오늘(KST) 이미 기록된 Date → 다시 쓰지 않음 (예전 버그: 항상 true)', () => {
        const recordedAt = new Date('2026-10-12T01:00:00.000Z'); // 10:00 KST
        expect(needsLoginTimestampUpdate(recordedAt, kst2359)).toBe(false);
    });

    it('KST 자정 경계: 23:59 KST 기록 → 같은 날 23:59 엔 false, 00:00 KST 엔 true', () => {
        expect(needsLoginTimestampUpdate(kst2359, kst2359)).toBe(false);
        expect(needsLoginTimestampUpdate(kst2359, kst0000)).toBe(true);
    });

    it('00:00 KST 기록 → 같은 KST 날 동안 false', () => {
        const sameDayLate = new Date('2026-10-13T14:59:59.000Z'); // 2026-10-13 23:59:59 KST
        expect(needsLoginTimestampUpdate(kst0000, kst0000)).toBe(false);
        expect(needsLoginTimestampUpdate(kst0000, sameDayLate)).toBe(false);
    });

    it('UTC 날짜는 같아도 KST 날짜가 바뀌면 true', () => {
        // 둘 다 UTC 2026-10-12. 기록은 KST 10/12 08:00, 지금은 KST 10/13 00:30
        const recordedAt = new Date('2026-10-11T23:00:00.000Z');
        const now = new Date('2026-10-12T15:30:00.000Z');
        expect(needsLoginTimestampUpdate(recordedAt, now)).toBe(true);
    });

    it('캐시 JSON(UTC ISO)·DATETIME 문자열도 같은 기준', () => {
        expect(needsLoginTimestampUpdate('2026-10-12T01:00:00.000Z', kst2359)).toBe(false);
        expect(needsLoginTimestampUpdate('2026-10-12 10:00:00', kst2359)).toBe(false);
        expect(needsLoginTimestampUpdate('2026-10-11 23:59:59', kst0000)).toBe(true);
    });

    it('값 없음·그누보드 0 날짜 → true', () => {
        expect(needsLoginTimestampUpdate(null, kst0000)).toBe(true);
        expect(needsLoginTimestampUpdate('', kst0000)).toBe(true);
        expect(needsLoginTimestampUpdate('0000-00-00 00:00:00', kst0000)).toBe(true);
    });
});

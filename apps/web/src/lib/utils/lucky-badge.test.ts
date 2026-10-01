import { describe, expect, it } from 'vitest';
import { formatLuckyBadge, luckyFields } from './lucky-badge';

describe('formatLuckyBadge', () => {
    it('포인트만', () => {
        expect(formatLuckyBadge(1234)).toBe('🍀1,234p');
        expect(formatLuckyBadge(1234, 0)).toBe('🍀1,234p');
    });

    it('경험치만', () => {
        expect(formatLuckyBadge(0, 500)).toBe('🍀500XP');
    });

    it('둘 다', () => {
        expect(formatLuckyBadge(1234, 500)).toBe('🍀1,234p·500XP');
    });

    it('둘 다 0 이하이거나 없으면 빈 문자열', () => {
        expect(formatLuckyBadge(0, 0)).toBe('');
        expect(formatLuckyBadge(-5, -1)).toBe('');
        expect(formatLuckyBadge(undefined, undefined)).toBe('');
        expect(formatLuckyBadge(null, null)).toBe('');
        expect(formatLuckyBadge(Number.NaN, Number.NaN)).toBe('');
    });

    it('음수 갈래는 무시하고 양수 갈래만 표시', () => {
        expect(formatLuckyBadge(-10, 500)).toBe('🍀500XP');
        expect(formatLuckyBadge(1234, -1)).toBe('🍀1,234p');
    });
});

describe('luckyFields (댓글 응답 병합)', () => {
    it('포인트만 있으면 lucky_point 만 싣는다 — 기존 응답과 동일', () => {
        expect(luckyFields(100, undefined)).toEqual({ lucky_point: 100 });
    });

    it('경험치만 있으면 lucky_exp 만 싣는다', () => {
        expect(luckyFields(undefined, 50)).toEqual({ lucky_exp: 50 });
    });

    it('둘 다 있으면 둘 다 싣는다', () => {
        expect(luckyFields(100, 50)).toEqual({ lucky_point: 100, lucky_exp: 50 });
    });

    it('둘 다 없거나 0 이하이면 키를 싣지 않는다', () => {
        expect(luckyFields(undefined, undefined)).toEqual({});
        expect(luckyFields(0, 0)).toEqual({});
        expect(luckyFields(-1, -1)).toEqual({});
    });

    it('경험치 조회 실패(빈 맵) 시 포인트 응답은 그대로', () => {
        const pointMap = new Map<number, number>([[7, 300]]);
        const expMap = new Map<number, number>();
        expect(luckyFields(pointMap.get(7), expMap.get(7))).toEqual({ lucky_point: 300 });
    });
});

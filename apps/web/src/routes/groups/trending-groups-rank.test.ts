import { describe, it, expect } from 'vitest';
import { rankTrendingGroups, clampLimit, type TrendingGroupRow } from './trending-groups-rank';

function row(bo_table: string, weekly: number, today = 0, subject = bo_table): TrendingGroupRow {
    return { bo_table, bo_subject: subject, weekly_count: weekly, today_count: today };
}

describe('clampLimit', () => {
    it('3~5 범위 안의 값은 그대로 통과', () => {
        expect(clampLimit(3)).toBe(3);
        expect(clampLimit(4)).toBe(4);
        expect(clampLimit(5)).toBe(5);
    });

    it('하한 미만은 3으로, 상한 초과는 5로 수렴', () => {
        expect(clampLimit(1)).toBe(3);
        expect(clampLimit(0)).toBe(3);
        expect(clampLimit(-10)).toBe(3);
        expect(clampLimit(99)).toBe(5);
    });

    it('숫자 문자열은 파싱, 잘못된 값은 상한(5)으로 안전 수렴', () => {
        expect(clampLimit('4')).toBe(4);
        expect(clampLimit('abc')).toBe(5);
        expect(clampLimit(null)).toBe(5);
        expect(clampLimit(undefined)).toBe(5);
        expect(clampLimit(NaN)).toBe(5);
    });
});

describe('rankTrendingGroups', () => {
    it('주간 글수 내림차순으로 정렬한다', () => {
        const result = rankTrendingGroups([row('a', 3), row('b', 10), row('c', 7)], 5);
        expect(result.map((r) => r.bo_table)).toEqual(['b', 'c', 'a']);
    });

    it('주간 글수 0(활동 없음) 소모임은 제외한다', () => {
        const result = rankTrendingGroups([row('a', 0), row('b', 5), row('c', 0)], 5);
        expect(result.map((r) => r.bo_table)).toEqual(['b']);
    });

    it('모두 활동 0이면 빈 배열 → 위젯 미표시(폴백)', () => {
        expect(rankTrendingGroups([row('a', 0), row('b', 0)], 5)).toEqual([]);
    });

    it('주간 동점이면 오늘 글수 내림차순으로 우선한다', () => {
        const result = rankTrendingGroups([row('a', 5, 1), row('b', 5, 4), row('c', 5, 2)], 5);
        expect(result.map((r) => r.bo_table)).toEqual(['b', 'c', 'a']);
    });

    it('주간·오늘 모두 동점이면 이름 오름차순으로 안정 정렬한다', () => {
        const result = rankTrendingGroups(
            [row('z', 5, 2, '지읒'), row('a', 5, 2, '가나'), row('m', 5, 2, '마바')],
            5
        );
        expect(result.map((r) => r.bo_subject)).toEqual(['가나', '마바', '지읒']);
    });

    it('limit 을 3~5 범위로 제한해 상위 N개만 반환한다', () => {
        const rows = [row('a', 9), row('b', 8), row('c', 7), row('d', 6), row('e', 5), row('f', 4)];
        expect(rankTrendingGroups(rows, 3)).toHaveLength(3);
        expect(rankTrendingGroups(rows, 5)).toHaveLength(5);
        // 상한 초과 요청은 5로 수렴
        expect(rankTrendingGroups(rows, 99)).toHaveLength(5);
        // 하한 미만 요청은 3으로 수렴
        expect(rankTrendingGroups(rows, 1)).toHaveLength(3);
    });

    it('입력 배열을 변형하지 않는다(순수 함수)', () => {
        const rows = [row('a', 3), row('b', 10)];
        const snapshot = rows.map((r) => r.bo_table);
        rankTrendingGroups(rows, 5);
        expect(rows.map((r) => r.bo_table)).toEqual(snapshot);
    });
});

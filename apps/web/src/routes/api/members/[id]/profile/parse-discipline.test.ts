import { describe, it, expect } from 'vitest';
import { parseDisciplineLogContent } from './_parse-discipline';

describe('parseDisciplineLogContent', () => {
    it('정상 JSON: penalty_period / penalty_date_from / sg_types 추출', () => {
        const row = {
            wr_id: 912,
            wr_content: JSON.stringify({
                penalty_period: 7,
                penalty_date_from: '2025-01-15 13:30:00',
                sg_types: ['도배', '비방']
            }),
            wr_datetime: '2025-01-15 13:30:05'
        };
        const result = parseDisciplineLogContent(row);
        expect(result).toEqual({
            penalty_period: 7,
            penalty_date_from: '2025-01-15 13:30:00',
            sg_types: ['도배', '비방'],
            wr_id: 912
        });
    });

    it('penalty_date_from 누락 시 wr_datetime fallback', () => {
        const row = {
            wr_id: 1041,
            wr_content: JSON.stringify({ penalty_period: 3 }),
            wr_datetime: '2025-02-01 09:00:00'
        };
        const result = parseDisciplineLogContent(row);
        expect(result?.penalty_date_from).toBe('2025-02-01 09:00:00');
        expect(result?.penalty_period).toBe(3);
        expect(result?.sg_types).toBeUndefined();
    });

    it('penalty_period === 0 (주의) 도 정상 처리', () => {
        const row = {
            wr_id: 3346,
            wr_content: JSON.stringify({
                penalty_period: 0,
                penalty_date_from: '2025-03-01 00:00:00'
            }),
            wr_datetime: '2025-03-01 00:00:00'
        };
        const result = parseDisciplineLogContent(row);
        expect(result?.penalty_period).toBe(0);
        expect(result?.penalty_date_from).toBe('2025-03-01 00:00:00');
    });

    it('penalty_period === -1 (영구정지) 도 정상 처리', () => {
        const row = {
            wr_id: 3304,
            wr_content: JSON.stringify({
                penalty_period: -1,
                penalty_date_from: '2025-03-15 12:00:00'
            }),
            wr_datetime: '2025-03-15 12:00:00'
        };
        const result = parseDisciplineLogContent(row);
        expect(result?.penalty_period).toBe(-1);
    });

    it('JSON 파싱 실패 시 null', () => {
        const row = {
            wr_id: 1,
            wr_content: 'not a json {{{',
            wr_datetime: '2025-01-01 00:00:00'
        };
        expect(parseDisciplineLogContent(row)).toBeNull();
    });

    it('penalty_period 누락 시 null', () => {
        const row = {
            wr_id: 2,
            wr_content: JSON.stringify({ note: '단순 메모' }),
            wr_datetime: '2025-01-01 00:00:00'
        };
        expect(parseDisciplineLogContent(row)).toBeNull();
    });

    it('penalty_period === null 시 null (undefined 와 동일하게 skip)', () => {
        const row = {
            wr_id: 3,
            wr_content: JSON.stringify({ penalty_period: null }),
            wr_datetime: '2025-01-01 00:00:00'
        };
        expect(parseDisciplineLogContent(row)).toBeNull();
    });

    it('빈 wr_content 시 null', () => {
        const row = {
            wr_id: 4,
            wr_content: '',
            wr_datetime: '2025-01-01 00:00:00'
        };
        expect(parseDisciplineLogContent(row)).toBeNull();
    });

    it('penalty_period 가 문자열이어도 Number 로 변환', () => {
        const row = {
            wr_id: 5,
            wr_content: JSON.stringify({
                penalty_period: '7',
                penalty_date_from: '2025-01-15 00:00:00'
            }),
            wr_datetime: '2025-01-15 00:00:00'
        };
        const result = parseDisciplineLogContent(row);
        expect(result?.penalty_period).toBe(7);
        expect(typeof result?.penalty_period).toBe('number');
    });

    it('sg_types 가 배열이 아니면 undefined', () => {
        const row = {
            wr_id: 6,
            wr_content: JSON.stringify({
                penalty_period: 7,
                penalty_date_from: '2025-01-15 00:00:00',
                sg_types: '단일문자열'
            }),
            wr_datetime: '2025-01-15 00:00:00'
        };
        const result = parseDisciplineLogContent(row);
        expect(result?.sg_types).toBeUndefined();
    });
});

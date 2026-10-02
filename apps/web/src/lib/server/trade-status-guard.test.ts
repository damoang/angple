import { describe, expect, it } from 'vitest';
import { isTradeStatusBoard, parsePostId, TRADE_STATUS_BOARDS } from './trade-status-guard';

describe('isTradeStatusBoard', () => {
    it('trade 게시판만 허용한다', () => {
        expect(TRADE_STATUS_BOARDS).toEqual(['trade']);
        expect(isTradeStatusBoard('trade')).toBe(true);
    });

    it('목록 밖 게시판은 거부한다', () => {
        expect(isTradeStatusBoard('free')).toBe(false);
        expect(isTradeStatusBoard('notice')).toBe(false);
        expect(isTradeStatusBoard('trades')).toBe(false);
    });

    it('대소문자가 다르면 거부한다', () => {
        expect(isTradeStatusBoard('Trade')).toBe(false);
        expect(isTradeStatusBoard('TRADE')).toBe(false);
    });

    it('이상한 값은 거부한다', () => {
        expect(isTradeStatusBoard('')).toBe(false);
        expect(isTradeStatusBoard(' trade')).toBe(false);
        expect(isTradeStatusBoard('trade ')).toBe(false);
        expect(isTradeStatusBoard('trade%00')).toBe(false);
        expect(isTradeStatusBoard('../trade')).toBe(false);
        expect(isTradeStatusBoard(undefined)).toBe(false);
        expect(isTradeStatusBoard(null)).toBe(false);
        expect(isTradeStatusBoard(['trade'])).toBe(false);
    });
});

describe('parsePostId', () => {
    it('양의 정수 문자열은 숫자로 돌려준다', () => {
        expect(parsePostId('1')).toBe(1);
        expect(parsePostId('123456')).toBe(123456);
    });

    it('0·음수·소수·지수·앞자리 0 은 거부한다', () => {
        expect(parsePostId('0')).toBeNull();
        expect(parsePostId('-1')).toBeNull();
        expect(parsePostId('1.5')).toBeNull();
        expect(parsePostId('1e3')).toBeNull();
        expect(parsePostId('012')).toBeNull();
    });

    it('숫자가 아니거나 공백이 섞이면 거부한다', () => {
        expect(parsePostId('')).toBeNull();
        expect(parsePostId('abc')).toBeNull();
        expect(parsePostId('12abc')).toBeNull();
        expect(parsePostId(' 12')).toBeNull();
        expect(parsePostId('12 ')).toBeNull();
        expect(parsePostId(undefined)).toBeNull();
    });

    it('안전 정수 범위를 넘으면 거부한다', () => {
        expect(parsePostId('9007199254740993')).toBeNull();
    });
});

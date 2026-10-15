import { describe, expect, it } from 'vitest';
import { hasUserBasicCookie, shouldFetchAuthMe } from './auth-me-skip';

describe('shouldFetchAuthMe', () => {
    it('SSR 비로그인 확정·장애 아님·user_basic 없음이면 요청하지 않는다', () => {
        expect(
            shouldFetchAuthMe({ isLoggedIn: false, authDegraded: false, hasUserBasic: false })
        ).toBe(false);
    });

    it('SSR 이 로그인이라고 하면 요청한다', () => {
        expect(
            shouldFetchAuthMe({ isLoggedIn: true, authDegraded: false, hasUserBasic: false })
        ).toBe(true);
    });

    it('로그인 여부가 실려 오지 않으면 이전처럼 요청한다', () => {
        expect(
            shouldFetchAuthMe({ isLoggedIn: undefined, authDegraded: false, hasUserBasic: false })
        ).toBe(true);
        expect(
            shouldFetchAuthMe({ isLoggedIn: null, authDegraded: false, hasUserBasic: false })
        ).toBe(true);
    });

    it('세션 조회 장애면 비로그인이라도 요청한다', () => {
        expect(
            shouldFetchAuthMe({ isLoggedIn: false, authDegraded: true, hasUserBasic: false })
        ).toBe(true);
    });

    it('user_basic 쿠키가 있으면 비로그인이라도 요청한다', () => {
        expect(
            shouldFetchAuthMe({ isLoggedIn: false, authDegraded: false, hasUserBasic: true })
        ).toBe(true);
    });

    it('authDegraded 가 누락돼도 다른 조건이 맞으면 요청하지 않는다', () => {
        expect(
            shouldFetchAuthMe({ isLoggedIn: false, authDegraded: undefined, hasUserBasic: false })
        ).toBe(false);
    });
});

describe('hasUserBasicCookie', () => {
    it('빈 문자열·null 이면 false', () => {
        expect(hasUserBasicCookie('')).toBe(false);
        expect(hasUserBasicCookie(null)).toBe(false);
        expect(hasUserBasicCookie(undefined)).toBe(false);
    });

    it('첫 번째·중간 위치의 user_basic 을 찾는다', () => {
        expect(hasUserBasicCookie('user_basic=abc')).toBe(true);
        expect(hasUserBasicCookie('a=1; user_basic=abc; b=2')).toBe(true);
    });

    it('값이 깨져 있어도 존재하면 true', () => {
        expect(hasUserBasicCookie('a=1; user_basic=%%%not-base64')).toBe(true);
    });

    it('이름이 비슷한 다른 쿠키는 무시한다', () => {
        expect(hasUserBasicCookie('x_user_basic=abc; user_basic_old=1')).toBe(false);
    });

    it('값이 빈 user_basic 은 없는 것으로 본다', () => {
        expect(hasUserBasicCookie('user_basic=; a=1')).toBe(false);
    });
});

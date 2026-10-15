import { describe, expect, it } from 'vitest';
import {
    hasSsrAuthCookie,
    hasUserBasicCookie,
    shouldFetchAuthMe,
    type AuthMeFetchInput
} from './auth-me-skip';

/** 「비로그인 확정」 기본 입력 — 요청을 생략하는 유일한 조합. */
const anon: AuthMeFetchInput = {
    isLoggedIn: false,
    authDegraded: false,
    hasUserBasic: false,
    hasSsrAuth: false
};

describe('shouldFetchAuthMe', () => {
    it('SSR 비로그인 확정·장애 아님·쿠키 없음이면 요청하지 않는다', () => {
        expect(shouldFetchAuthMe(anon)).toBe(false);
    });

    it('SSR 이 로그인이라고 하면 요청한다', () => {
        expect(shouldFetchAuthMe({ ...anon, isLoggedIn: true })).toBe(true);
    });

    it('로그인 여부가 실려 오지 않으면 이전처럼 요청한다', () => {
        expect(shouldFetchAuthMe({ ...anon, isLoggedIn: undefined })).toBe(true);
        expect(shouldFetchAuthMe({ ...anon, isLoggedIn: null })).toBe(true);
    });

    it('세션 조회 장애면 비로그인이라도 요청한다', () => {
        expect(shouldFetchAuthMe({ ...anon, authDegraded: true })).toBe(true);
    });

    it('user_basic 쿠키가 있으면 비로그인이라도 요청한다', () => {
        expect(shouldFetchAuthMe({ ...anon, hasUserBasic: true })).toBe(true);
    });

    it('ssr_auth 쿠키가 있으면 비로그인이라도 요청한다', () => {
        expect(shouldFetchAuthMe({ ...anon, hasSsrAuth: true })).toBe(true);
    });

    it('authDegraded 가 누락돼도 다른 조건이 맞으면 요청하지 않는다', () => {
        expect(shouldFetchAuthMe({ ...anon, authDegraded: undefined })).toBe(false);
    });

    it('쿠키 문자열에서 판정한 결과로도 같은 결론이 난다', () => {
        const cookie = 'a=1; x_ssr_auth=1; ssr_auth_old=1; x_user_basic=abc';
        expect(
            shouldFetchAuthMe({
                ...anon,
                hasUserBasic: hasUserBasicCookie(cookie),
                hasSsrAuth: hasSsrAuthCookie(cookie)
            })
        ).toBe(false);
        expect(
            shouldFetchAuthMe({
                ...anon,
                hasUserBasic: hasUserBasicCookie('a=1; ssr_auth=1'),
                hasSsrAuth: hasSsrAuthCookie('a=1; ssr_auth=1')
            })
        ).toBe(true);
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

describe('hasSsrAuthCookie', () => {
    it('빈 문자열·null 이면 false', () => {
        expect(hasSsrAuthCookie('')).toBe(false);
        expect(hasSsrAuthCookie(null)).toBe(false);
        expect(hasSsrAuthCookie(undefined)).toBe(false);
    });

    it('첫 번째·중간·마지막 위치의 ssr_auth 를 찾는다', () => {
        expect(hasSsrAuthCookie('ssr_auth=1')).toBe(true);
        expect(hasSsrAuthCookie('a=1; ssr_auth=1; b=2')).toBe(true);
        expect(hasSsrAuthCookie('a=1; ssr_auth=1')).toBe(true);
    });

    it('이름이 비슷한 다른 쿠키는 무시한다', () => {
        expect(hasSsrAuthCookie('x_ssr_auth=1; ssr_auth_old=1')).toBe(false);
    });

    it('값이 빈 ssr_auth 는 없는 것으로 본다', () => {
        expect(hasSsrAuthCookie('ssr_auth=; a=1')).toBe(false);
        expect(hasSsrAuthCookie('a=1; ssr_auth=')).toBe(false);
    });
});

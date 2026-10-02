import { describe, expect, it } from 'vitest';
import {
    hasAuthCookie,
    isCacheableNotFoundPath,
    shouldPublicCacheNotFound
} from './not-found-cache';

const anon = { status: 404, hasUser: false, hasAuthCookie: false };

describe('shouldPublicCacheNotFound', () => {
    it('비로그인의 정적·옛 주소 404 는 공개 캐시한다', () => {
        for (const pathname of [
            '/theme/x.css',
            '/themes/a/b.js',
            '/wp-login',
            '/a/b.php',
            '/x.aspx'
        ]) {
            expect(shouldPublicCacheNotFound({ ...anon, pathname })).toBe(true);
        }
    });

    it('회원이 확인된 요청의 404 는 공개 캐시하지 않는다', () => {
        expect(shouldPublicCacheNotFound({ ...anon, pathname: '/a/b.php', hasUser: true })).toBe(
            false
        );
    });

    it('인증 쿠키가 실린 요청의 404 는 회원 확인에 실패했어도 공개 캐시하지 않는다', () => {
        expect(
            shouldPublicCacheNotFound({ ...anon, pathname: '/a/b.php', hasAuthCookie: true })
        ).toBe(false);
    });

    it('경로와 무관하게 로그인 요청이면 공개 캐시하지 않는다', () => {
        for (const pathname of ['/a/x/y.php', '/b/x.php', '/c/x.aspx', '/theme/x.css']) {
            expect(shouldPublicCacheNotFound({ ...anon, pathname, hasUser: true })).toBe(false);
            expect(shouldPublicCacheNotFound({ ...anon, pathname, hasAuthCookie: true })).toBe(
                false
            );
        }
    });

    it('404 가 아니면 대상이 아니다', () => {
        expect(shouldPublicCacheNotFound({ ...anon, status: 200, pathname: '/a/b.php' })).toBe(
            false
        );
        expect(shouldPublicCacheNotFound({ ...anon, status: 500, pathname: '/a/b.php' })).toBe(
            false
        );
    });

    it('정적·옛 주소 모양이 아닌 404 는 대상이 아니다', () => {
        expect(shouldPublicCacheNotFound({ ...anon, pathname: '/free/123456789' })).toBe(false);
        expect(shouldPublicCacheNotFound({ ...anon, pathname: '/no-such-page' })).toBe(false);
    });
});

describe('isCacheableNotFoundPath', () => {
    it('확장자는 경로 끝에서만 본다', () => {
        expect(isCacheableNotFoundPath('/a.php/b')).toBe(false);
        expect(isCacheableNotFoundPath('/a/b.php')).toBe(true);
    });
});

describe('hasAuthCookie', () => {
    const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];

    it('쿠키가 없으면 false', () => {
        expect(hasAuthCookie(jar({}), 'sid')).toBe(false);
        expect(hasAuthCookie(jar({ theme: 'dark' }), 'sid')).toBe(false);
    });

    it('세션 쿠키가 있으면 true', () => {
        expect(hasAuthCookie(jar({ sid: 'abc' }), 'sid')).toBe(true);
    });

    it('토큰 쿠키만 있어도 true', () => {
        expect(hasAuthCookie(jar({ damoang_jwt: 'x' }), 'sid')).toBe(true);
        expect(hasAuthCookie(jar({ access_token: 'x' }), 'sid')).toBe(true);
        expect(hasAuthCookie(jar({ refresh_token: 'x' }), 'sid')).toBe(true);
    });

    it('빈 값은 없는 것으로 본다', () => {
        expect(hasAuthCookie(jar({ sid: '' }), 'sid')).toBe(false);
    });
});

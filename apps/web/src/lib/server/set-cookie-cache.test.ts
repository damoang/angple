import { describe, it, expect } from 'vitest';
import {
    SET_COOKIE_CACHE_CONTROL,
    enforcePrivateOnSetCookie,
    hasSetCookieHeader,
    resolveCacheControlForSetCookie
} from './set-cookie-cache';

const REDIRECT_PUBLIC = 'public, s-maxage=86400, max-age=3600, stale-while-revalidate=604800';
const API_PUBLIC = 'public, max-age=60, s-maxage=300';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const PRIVATE_DEFAULT = 'private, max-age=2, must-revalidate';
const COOKIE = 'user_basic=abc; Path=/; Max-Age=2592000; SameSite=Lax';

describe('resolveCacheControlForSetCookie', () => {
    it('Set-Cookie 가 없으면 기존 값을 유지한다', () => {
        expect(resolveCacheControlForSetCookie(REDIRECT_PUBLIC, false)).toBe(REDIRECT_PUBLIC);
        expect(resolveCacheControlForSetCookie(API_PUBLIC, false)).toBe(API_PUBLIC);
        expect(resolveCacheControlForSetCookie(PRIVATE_DEFAULT, false)).toBe(PRIVATE_DEFAULT);
        expect(resolveCacheControlForSetCookie(null, false)).toBeNull();
    });

    it('Set-Cookie 가 있으면 어떤 값이든 private, no-store 로 바꾼다', () => {
        expect(resolveCacheControlForSetCookie(REDIRECT_PUBLIC, true)).toBe(
            SET_COOKIE_CACHE_CONTROL
        );
        expect(resolveCacheControlForSetCookie(API_PUBLIC, true)).toBe(SET_COOKIE_CACHE_CONTROL);
        expect(resolveCacheControlForSetCookie(null, true)).toBe(SET_COOKIE_CACHE_CONTROL);
    });
});

describe('hasSetCookieHeader', () => {
    it('Set-Cookie 유무를 판정한다', () => {
        const without = new Headers({ 'Cache-Control': API_PUBLIC });
        expect(hasSetCookieHeader(without)).toBe(false);

        const withOne = new Headers();
        withOne.append('set-cookie', COOKIE);
        expect(hasSetCookieHeader(withOne)).toBe(true);
    });
});

describe('enforcePrivateOnSetCookie', () => {
    it('Set-Cookie 가 없으면 헤더를 건드리지 않는다', () => {
        const headers = new Headers({
            'Cache-Control': API_PUBLIC,
            Vary: 'Host, Cookie, User-Agent, Accept-Encoding'
        });
        expect(enforcePrivateOnSetCookie(headers)).toBe(false);
        expect(headers.get('Cache-Control')).toBe(API_PUBLIC);
        expect(headers.get('Vary')).toBe('Host, Cookie, User-Agent, Accept-Encoding');
    });

    it('301·308 + Set-Cookie 는 private 으로 바뀐다', () => {
        const headers = new Headers({ 'Cache-Control': REDIRECT_PUBLIC, Location: '/free' });
        headers.append('set-cookie', COOKIE);
        expect(enforcePrivateOnSetCookie(headers)).toBe(true);
        expect(headers.get('Cache-Control')).toBe(SET_COOKIE_CACHE_CONTROL);
        // 쿠키 자체는 그대로 남아야 본인에게 전달된다
        expect(headers.getSetCookie()).toEqual([COOKIE]);
    });

    it('public API 응답 + Set-Cookie 는 private 으로 바뀐다', () => {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Cache-Control': API_PUBLIC
        });
        headers.append('set-cookie', COOKIE);
        headers.append('set-cookie', 'ssr_auth=1; Path=/; SameSite=Lax');
        expect(enforcePrivateOnSetCookie(headers)).toBe(true);
        expect(headers.get('Cache-Control')).toBe(SET_COOKIE_CACHE_CONTROL);
        expect(headers.getSetCookie()).toHaveLength(2);
    });

    it('CDN 전용 캐시 헤더도 함께 지운다', () => {
        const headers = new Headers({
            'Cache-Control': API_PUBLIC,
            'CDN-Cache-Control': 'max-age=300',
            'Cloudflare-CDN-Cache-Control': 'max-age=300',
            'Surrogate-Control': 'max-age=300'
        });
        headers.append('set-cookie', COOKIE);
        enforcePrivateOnSetCookie(headers);
        expect(headers.has('CDN-Cache-Control')).toBe(false);
        expect(headers.has('Cloudflare-CDN-Cache-Control')).toBe(false);
        expect(headers.has('Surrogate-Control')).toBe(false);
    });

    it('_app/immutable 자원(Set-Cookie 없음)은 영향이 없다', () => {
        const headers = new Headers({
            'Content-Type': 'text/javascript',
            'Cache-Control': IMMUTABLE
        });
        expect(enforcePrivateOnSetCookie(headers)).toBe(false);
        expect(headers.get('Cache-Control')).toBe(IMMUTABLE);
    });
});

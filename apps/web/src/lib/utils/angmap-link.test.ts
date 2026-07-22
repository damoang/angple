import { describe, expect, it } from 'vitest';
import { findMapLink, normalizeMapUrl, isSupportedMapUrl } from './angmap-link';

describe('normalizeMapUrl', () => {
    it('strips zero-width characters (실측: kko.to 링크 끝 U+200B)', () => {
        expect(normalizeMapUrl('https://kko.to/AbCdEf' + '\u200B')).toBe('https://kko.to/AbCdEf');
        expect(normalizeMapUrl('https://naver.me/xyz' + '\u2060\uFEFF')).toBe(
            'https://naver.me/xyz'
        );
    });

    it('restores &amp; entities from HTML content', () => {
        expect(normalizeMapUrl('https://map.naver.com/?lat=37.5&amp;lng=127.1')).toBe(
            'https://map.naver.com/?lat=37.5&lng=127.1'
        );
    });

    it('strips trailing sentence punctuation', () => {
        expect(normalizeMapUrl('https://naver.me/abc123.')).toBe('https://naver.me/abc123');
        expect(normalizeMapUrl('https://naver.me/abc123)')).toBe('https://naver.me/abc123');
        expect(normalizeMapUrl('https://naver.me/abc123",')).toBe('https://naver.me/abc123');
    });

    it('keeps digits/alnum endings intact (구글 !4d 좌표)', () => {
        const url =
            'https://www.google.com/maps/place/x/@34.08,-118.34,17z/data=!3d34.08!4d-118.34';
        expect(normalizeMapUrl(url)).toBe(url);
    });
});

describe('isSupportedMapUrl', () => {
    it('accepts map hosts', () => {
        expect(isSupportedMapUrl(new URL('https://naver.me/xyz'))).toBe(true);
        expect(isSupportedMapUrl(new URL('https://kko.to/abc'))).toBe(true);
        expect(isSupportedMapUrl(new URL('https://maps.app.goo.gl/abc'))).toBe(true);
        expect(isSupportedMapUrl(new URL('https://place.map.kakao.com/10893325'))).toBe(true);
        expect(isSupportedMapUrl(new URL('https://m.place.naver.com/restaurant/123/home'))).toBe(
            true
        );
    });

    it('accepts google.com only under /maps', () => {
        expect(isSupportedMapUrl(new URL('https://www.google.com/maps/place/Foo'))).toBe(true);
        expect(isSupportedMapUrl(new URL('https://www.google.com/search?q=map'))).toBe(false);
        expect(isSupportedMapUrl(new URL('https://goo.gl/maps/abc'))).toBe(true);
        expect(isSupportedMapUrl(new URL('https://goo.gl/abc'))).toBe(false);
    });

    it('rejects non-map and non-http urls', () => {
        expect(isSupportedMapUrl(new URL('https://damoang.net/free/1'))).toBe(false);
        expect(isSupportedMapUrl(new URL('https://evil.naver.me.example.com/x'))).toBe(false);
        expect(isSupportedMapUrl(new URL('ftp://naver.me/x'))).toBe(false);
    });
});

describe('findMapLink', () => {
    it('finds a map link inside HTML content', () => {
        const html = '<p>여기 좋아요 <a href="https://naver.me/FabCd12">링크</a> 참고</p>';
        expect(findMapLink(html)).toBe('https://naver.me/FabCd12');
    });

    it('ignores non-map links and returns first map link', () => {
        const text = '영상 https://youtu.be/abc 보고 https://place.map.kakao.com/10893325 가보세요';
        expect(findMapLink(text)).toBe('https://place.map.kakao.com/10893325');
    });

    it('returns null when no map link exists', () => {
        expect(findMapLink('지도 링크 없는 글')).toBeNull();
        expect(findMapLink('')).toBeNull();
        expect(findMapLink('https://damoang.net/angmap/1')).toBeNull();
    });

    it('does not absorb Korean text following the URL', () => {
        const text = '위치는 https://naver.me/AbCd12이에요';
        expect(findMapLink(text)).toBe('https://naver.me/AbCd12');
    });
});

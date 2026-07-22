import { describe, expect, it } from 'vitest';
import {
    isValidLatLng,
    parseGoogleCoords,
    parseNaverMapCoords,
    parseKakaoRouteCoords,
    extractNaverPlaceId,
    extractKakaoPlaceId,
    parseNaverPlaceHtml,
    parseOgTag
} from './angmap-resolve';

describe('isValidLatLng', () => {
    it('validates ranges and rejects (0,0)', () => {
        expect(isValidLatLng(37.5, 127.0)).toBe(true);
        expect(isValidLatLng(-33.9, 151.2)).toBe(true);
        expect(isValidLatLng(0, 0)).toBe(false);
        expect(isValidLatLng(91, 127)).toBe(false);
        expect(isValidLatLng(37, 181)).toBe(false);
        expect(isValidLatLng(NaN, 127)).toBe(false);
    });
});

describe('parseGoogleCoords', () => {
    // 실측: goo.gl 해소 후 최종 URL — @=지도 중심, !3d!4d=핀 좌표(우선)
    const url =
        'https://www.google.com/maps/place/Pink%27s+Hot+Dogs/@34.0850069,-118.3421537,17.25z/' +
        'data=!4m6!3m5!1s0x80c2b92c50cd11cf!8m2!3d34.0836153!4d-118.3388637!16s%2Fg%2F11b77t2gpw';

    it('prefers !3d!4d pin coords over @ center', () => {
        const parsed = parseGoogleCoords(url);
        expect(parsed).not.toBeNull();
        expect(parsed?.lat).toBeCloseTo(34.0836153, 6);
        expect(parsed?.lng).toBeCloseTo(-118.3388637, 6);
    });

    it('falls back to @lat,lng center when no pin coords', () => {
        const parsed = parseGoogleCoords('https://www.google.com/maps/@36.3526919,127.3550856,15z');
        expect(parsed?.lat).toBeCloseTo(36.3526919, 6);
        expect(parsed?.lng).toBeCloseTo(127.3550856, 6);
    });

    it('extracts place name from path (URL decode + "+" → space)', () => {
        const parsed = parseGoogleCoords(url);
        expect(parsed?.name).toBe("Pink's Hot Dogs");
    });

    it('returns null when no coords', () => {
        expect(parseGoogleCoords('https://www.google.com/maps/place/OnlyName')).toBeNull();
    });
});

describe('parseNaverMapCoords', () => {
    it('reads lat/lng query params', () => {
        const u = new URL('https://map.naver.com/?lat=37.5063971&lng=126.8605267&title=x');
        const parsed = parseNaverMapCoords(u);
        expect(parsed?.lat).toBeCloseTo(37.5063971, 6);
        expect(parsed?.lng).toBeCloseTo(126.8605267, 6);
    });

    it('returns null without params', () => {
        expect(parseNaverMapCoords(new URL('https://map.naver.com/p/entry/place/123'))).toBeNull();
    });
});

describe('parseKakaoRouteCoords', () => {
    it('parses ep coords and en name (실측 kko.to route 링크)', () => {
        const u = new URL(
            'https://applink.map.kakao.com/route?ep=37.30834,126.82810&en=%ED%94%BC%EC%A0%9C%EB%A6%AC%EC%95%84+%EB%9D%BC%EC%AA%BC'
        );
        const parsed = parseKakaoRouteCoords(u);
        expect(parsed?.lat).toBeCloseTo(37.30834, 5);
        expect(parsed?.lng).toBeCloseTo(126.8281, 4);
        expect(parsed?.name).toBe('피제리아 라쪼');
    });

    it('ignores non-route paths', () => {
        expect(
            parseKakaoRouteCoords(new URL('https://applink.map.kakao.com/place?id=10893325'))
        ).toBeNull();
    });
});

describe('extractNaverPlaceId', () => {
    it('extracts from m.place.naver.com paths (실측 naver.me 최종 URL)', () => {
        expect(
            extractNaverPlaceId(new URL('https://m.place.naver.com/restaurant/1271331461/home'))
        ).toBe('1271331461');
        expect(
            extractNaverPlaceId(
                new URL('https://m.place.naver.com/restaurant/1019680026/menu/list')
            )
        ).toBe('1019680026');
        expect(extractNaverPlaceId(new URL('https://place.naver.com/place/37202658'))).toBe(
            '37202658'
        );
    });

    it('extracts from share?id= (naver.me hop1)', () => {
        expect(extractNaverPlaceId(new URL('https://m.place.naver.com/share?id=1271331461'))).toBe(
            '1271331461'
        );
    });

    it('extracts pinId from m.map.naver.com appLink (아웃라이어)', () => {
        const u = new URL(
            'https://m.map.naver.com/appLink.naver?app=Y&pinType=site&pinId=1428808521'
        );
        expect(extractNaverPlaceId(u)).toBe('1428808521');
    });

    it('extracts from map.naver.com entry path', () => {
        expect(extractNaverPlaceId(new URL('https://map.naver.com/p/entry/place/1068491482'))).toBe(
            '1068491482'
        );
    });

    it('returns null for non-place urls', () => {
        expect(extractNaverPlaceId(new URL('https://map.naver.com/'))).toBeNull();
        expect(extractNaverPlaceId(new URL('https://m.place.naver.com/'))).toBeNull();
    });
});

describe('extractKakaoPlaceId', () => {
    it('extracts from place.map.kakao.com path', () => {
        expect(extractKakaoPlaceId(new URL('https://place.map.kakao.com/10893325'))).toBe(
            '10893325'
        );
    });

    it('extracts from applink place?id= (kko.to hop1)', () => {
        expect(
            extractKakaoPlaceId(new URL('https://applink.map.kakao.com/place?id=825774495'))
        ).toBe('825774495');
    });

    it('extracts itemId from map.kakao.com', () => {
        expect(extractKakaoPlaceId(new URL('https://map.kakao.com/?itemId=27325252'))).toBe(
            '27325252'
        );
    });

    it('returns null otherwise', () => {
        expect(extractKakaoPlaceId(new URL('https://map.kakao.com/#none'))).toBeNull();
        expect(
            extractKakaoPlaceId(new URL('https://applink.map.kakao.com/route?ep=1,2'))
        ).toBeNull();
    });
});

describe('parseNaverPlaceHtml', () => {
    // 실측 구조: 임베디드 상태 JSON — x=경도, y=위도
    const html =
        '<html><head>' +
        '<meta property="og:title" content="수밀 블랑제리 : 네이버" />' +
        '</head><body><script>window.__APOLLO_STATE__={' +
        '"PlaceDetailBase:1271331461":{"name":"수밀 블랑제리",' +
        '"roadAddress":"서울 구로구 중앙로 100 1층 103호 수밀 블랑제리",' +
        '"address":"서울 구로구 고척동 191-1",' +
        '"x":"126.8605267","y":"37.5063971"}}</script></body></html>';

    it('extracts name, roadAddress and coords (x=lng, y=lat)', () => {
        const parsed = parseNaverPlaceHtml(html);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe('수밀 블랑제리');
        expect(parsed?.roadAddress).toBe('서울 구로구 중앙로 100 1층 103호 수밀 블랑제리');
        expect(parsed?.lat).toBeCloseTo(37.5063971, 6);
        expect(parsed?.lng).toBeCloseTo(126.8605267, 6);
    });

    it('falls back to og:title when no name in JSON', () => {
        const htmlNoJson =
            '<meta property="og:title" content="오산리고기창고 : 네이버" />' +
            '<script>{"x":"127.148","y":"37.332"}</script>';
        const parsed = parseNaverPlaceHtml(htmlNoJson);
        expect(parsed?.name).toBe('오산리고기창고');
        expect(parsed?.lat).toBeCloseTo(37.332, 3);
    });

    it('returns null for unrelated html', () => {
        expect(parseNaverPlaceHtml('<html><body>404</body></html>')).toBeNull();
    });
});

describe('parseOgTag', () => {
    it('parses og tags in both attribute orders (실측 kakao og 셸)', () => {
        const html =
            '<meta property="og:title" content="피제리아 라쪼"/>' +
            '<meta content="경기 안산시 단원구 광덕서로 68" property="og:description"/>';
        expect(parseOgTag(html, 'title')).toBe('피제리아 라쪼');
        expect(parseOgTag(html, 'description')).toBe('경기 안산시 단원구 광덕서로 68');
    });

    it('decodes basic html entities', () => {
        const html = '<meta property="og:title" content="A &amp; B"/>';
        expect(parseOgTag(html, 'title')).toBe('A & B');
    });

    it('returns null when missing', () => {
        expect(parseOgTag('<html></html>', 'title')).toBeNull();
    });
});

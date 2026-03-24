/**
 * 제휴 링크 API 테스트
 * 도메인 매칭 로직 테스트
 */

import { describe, it, expect } from 'vitest';
import {
    detectPlatform,
    isAffiliateUrl,
    extractHost,
    getPlatformNameKo
} from './domain-matcher';

describe('도메인 매칭', () => {
    describe('extractHost', () => {
        it('URL에서 호스트 추출', () => {
            expect(extractHost('https://www.coupang.com/vp/products/123')).toBe('coupang.com');
            expect(extractHost('https://ko.aliexpress.com/item/123.html')).toBe('ko.aliexpress.com');
            expect(extractHost('https://amazon.co.jp/dp/B123')).toBe('amazon.co.jp');
        });

        it('www. 제거', () => {
            expect(extractHost('https://www.coupang.com/product')).toBe('coupang.com');
        });

        it('잘못된 URL', () => {
            expect(extractHost('not-a-url')).toBeNull();
        });
    });

    describe('detectPlatform', () => {
        it('쿠팡 도메인 감지', () => {
            expect(detectPlatform('https://www.coupang.com/vp/products/123')).toBe('coupang');
            expect(detectPlatform('https://link.coupang.com/re/AFFSDP?pageKey=123')).toBe('coupang');
            expect(detectPlatform('https://coupa.ng/abc123')).toBe('coupang');
        });

        it('알리익스프레스 도메인 감지', () => {
            expect(detectPlatform('https://ko.aliexpress.com/item/123.html')).toBe('aliexpress');
            expect(detectPlatform('https://www.aliexpress.com/item/456.html')).toBe('aliexpress');
            expect(detectPlatform('https://s.click.aliexpress.com/e/abc')).toBe('aliexpress');
        });

        it('아마존 도메인 감지', () => {
            expect(detectPlatform('https://amazon.com/dp/B123')).toBe('amazon');
            expect(detectPlatform('https://amazon.co.jp/dp/B456')).toBe('amazon');
            expect(detectPlatform('https://amzn.to/abc')).toBe('amazon');
        });

        it('KKday 도메인 감지', () => {
            expect(detectPlatform('https://www.kkday.com/ko/product/123')).toBe('kkday');
        });

        it('링크프라이스 도메인 감지', () => {
            expect(detectPlatform('https://click.linkprice.com/link?a=abc')).toBe('linkprice');
            expect(detectPlatform('https://www.gmarket.co.kr/item?goodsCode=123')).toBe('linkprice');
            expect(detectPlatform('https://www.11st.co.kr/products/123')).toBe('linkprice');
        });

        it('미지원 도메인', () => {
            expect(detectPlatform('https://example.com')).toBeNull();
            expect(detectPlatform('https://google.com')).toBeNull();
        });
    });

    describe('isAffiliateUrl', () => {
        it('제휴 대상 URL 확인', () => {
            expect(isAffiliateUrl('https://www.coupang.com/vp/products/123')).toBe(true);
            expect(isAffiliateUrl('https://ko.aliexpress.com/item/123.html')).toBe(true);
            expect(isAffiliateUrl('https://amazon.com/dp/B123')).toBe(true);
            expect(isAffiliateUrl('https://www.kkday.com/ko/product/123')).toBe(true);
            expect(isAffiliateUrl('https://www.gmarket.co.kr/item?goodsCode=123')).toBe(true);
        });

        it('비제휴 URL 확인', () => {
            expect(isAffiliateUrl('https://example.com')).toBe(false);
            expect(isAffiliateUrl('https://google.com/search?q=test')).toBe(false);
        });
    });

    describe('getPlatformNameKo', () => {
        it('플랫폼 한글 이름', () => {
            expect(getPlatformNameKo('coupang')).toBe('쿠팡');
            expect(getPlatformNameKo('aliexpress')).toBe('알리익스프레스');
            expect(getPlatformNameKo('amazon')).toBe('아마존');
            expect(getPlatformNameKo('kkday')).toBe('KKday');
            expect(getPlatformNameKo('linkprice')).toBe('링크프라이스');
        });
    });
});

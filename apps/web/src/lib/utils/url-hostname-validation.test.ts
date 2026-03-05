/**
 * URL hostname 검증 보안 수정 테스트
 * #66 - aliexpress.ts Incomplete URL substring sanitization
 * #67, #68 - coupang.ts Incomplete URL substring sanitization
 *
 * .includes('domain.com') 대신 URL 파싱 + hostname 검증 패턴 테스트
 */
import { describe, it, expect } from 'vitest';

// --- coupang.ts resolveShortUrl에서 사용하는 hostname 검증 패턴 ---
function isCoupangDomain(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.hostname === 'coupang.com' || parsed.hostname.endsWith('.coupang.com');
    } catch {
        return false;
    }
}

// --- coupang.ts buildCoupangFallbackUrl에서 사용하는 제휴 링크 검증 패턴 ---
function isCoupangAffiliateLink(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.hostname === 'link.coupang.com' ||
            parsed.hostname === 'coupa.ng' ||
            parsed.hostname.endsWith('.coupa.ng')
        );
    } catch {
        return false;
    }
}

// --- aliexpress.ts resolveShortUrl에서 사용하는 hostname 검증 패턴 ---
function isAliExpressDomain(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.hostname === 'aliexpress.com' || parsed.hostname.endsWith('.aliexpress.com')
        );
    } catch {
        return false;
    }
}

describe('쿠팡 도메인 검증', () => {
    it('www.coupang.com 허용', () => {
        expect(isCoupangDomain('https://www.coupang.com/vp/products/123')).toBe(true);
    });

    it('coupang.com 허용', () => {
        expect(isCoupangDomain('https://coupang.com/vp/products/123')).toBe(true);
    });

    it('m.coupang.com 허용', () => {
        expect(isCoupangDomain('https://m.coupang.com/vp/products/123')).toBe(true);
    });

    it('evil-coupang.com 차단 (부분문자열 공격)', () => {
        expect(isCoupangDomain('https://evil-coupang.com/vp/products/123')).toBe(false);
    });

    it('coupang.com.evil.com 차단 (서브도메인 위장)', () => {
        expect(isCoupangDomain('https://coupang.com.evil.com/path')).toBe(false);
    });

    it('잘못된 URL은 false', () => {
        expect(isCoupangDomain('not-a-url')).toBe(false);
    });

    it('포트가 포함된 URL도 정상 검증', () => {
        expect(isCoupangDomain('https://www.coupang.com:443/vp/products/123')).toBe(true);
    });

    it('path에 coupang.com이 있어도 hostname이 다르면 차단', () => {
        expect(isCoupangDomain('https://evil.com/redirect?url=coupang.com')).toBe(false);
    });

    it('userinfo를 이용한 위장 차단', () => {
        expect(isCoupangDomain('https://coupang.com@evil.com/path')).toBe(false);
    });

    it('빈 문자열은 false', () => {
        expect(isCoupangDomain('')).toBe(false);
    });
});

describe('쿠팡 제휴 링크 검증', () => {
    it('link.coupang.com 인식', () => {
        expect(isCoupangAffiliateLink('https://link.coupang.com/re/AFFSDP?lptag=123')).toBe(true);
    });

    it('coupa.ng 인식', () => {
        expect(isCoupangAffiliateLink('https://coupa.ng/abc123')).toBe(true);
    });

    it('일반 쿠팡 URL은 제휴 링크가 아님', () => {
        expect(isCoupangAffiliateLink('https://www.coupang.com/vp/products/123')).toBe(false);
    });

    it('fake-coupa.ng 차단', () => {
        expect(isCoupangAffiliateLink('https://fake-coupa.ng/abc')).toBe(false);
    });

    it('coupa.ng가 path에만 있으면 제휴 링크 아님', () => {
        expect(isCoupangAffiliateLink('https://evil.com/coupa.ng/abc')).toBe(false);
    });
});

describe('알리익스프레스 도메인 검증', () => {
    it('www.aliexpress.com 허용', () => {
        expect(isAliExpressDomain('https://www.aliexpress.com/item/123.html')).toBe(true);
    });

    it('ko.aliexpress.com 허용', () => {
        expect(isAliExpressDomain('https://ko.aliexpress.com/item/123.html')).toBe(true);
    });

    it('aliexpress.com 허용', () => {
        expect(isAliExpressDomain('https://aliexpress.com/item/123.html')).toBe(true);
    });

    it('evil-aliexpress.com 차단', () => {
        expect(isAliExpressDomain('https://evil-aliexpress.com/item/123.html')).toBe(false);
    });

    it('aliexpress.com.evil.com 차단', () => {
        expect(isAliExpressDomain('https://aliexpress.com.evil.com/path')).toBe(false);
    });

    it('잘못된 URL은 false', () => {
        expect(isAliExpressDomain('not-a-url')).toBe(false);
    });

    it('s.click.aliexpress.com 허용 (단축 URL 서브도메인)', () => {
        expect(isAliExpressDomain('https://s.click.aliexpress.com/e/_abc123')).toBe(true);
    });

    it('userinfo를 이용한 위장 차단', () => {
        expect(isAliExpressDomain('https://aliexpress.com@evil.com/item')).toBe(false);
    });

    it('빈 문자열은 false', () => {
        expect(isAliExpressDomain('')).toBe(false);
    });
});

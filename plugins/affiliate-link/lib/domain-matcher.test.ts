import { describe, expect, it } from 'vitest';
import { detectPlatform, normalizeUrl } from './domain-matcher';

describe('normalizeUrl', () => {
    it('스키마 없는 외부 URL에 https를 붙인다', () => {
        expect(normalizeUrl('aliexpress.com/item/100500')).toBe(
            'https://aliexpress.com/item/100500'
        );
    });

    it('프로토콜 상대 URL을 https로 정규화한다', () => {
        expect(normalizeUrl('//ko.aliexpress.com/item/100500')).toBe(
            'https://ko.aliexpress.com/item/100500'
        );
    });
});

describe('detectPlatform', () => {
    it('스키마 없는 AliExpress URL도 인식한다', () => {
        expect(detectPlatform('aliexpress.com/item/100500')).toBe('aliexpress');
    });

    it('스키마 없는 Coupang URL도 인식한다', () => {
        expect(detectPlatform('www.coupang.com/vp/products/123')).toBe('coupang');
    });
});

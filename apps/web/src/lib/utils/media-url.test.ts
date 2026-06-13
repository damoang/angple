import { describe, expect, it } from 'vitest';
import { normalizeMediaUrl, normalizeHtmlMediaUrls } from './media-url';

describe('normalizeMediaUrl — R2 prefix routing (Phase B1)', () => {
    it('routes data/content/* to r2.damoang.net (R2 prefix)', () => {
        const result = normalizeMediaUrl('data/content/img/logo.png');
        expect(result).toBe('https://r2.damoang.net/data/content/img/logo.png');
    });

    it('routes data/editor/* to s3.damoang.net (default, not R2 prefix yet)', () => {
        const result = normalizeMediaUrl('data/editor/2606/abc.webp');
        expect(result).toBe('https://s3.damoang.net/data/editor/2606/abc.webp');
    });

    it('routes data/member_image/* to s3.damoang.net (default)', () => {
        const result = normalizeMediaUrl('data/member_image/ad/admin.webp');
        expect(result).toBe('https://s3.damoang.net/data/member_image/ad/admin.webp');
    });

    it('rewrites s3.damoang.net/data/content/* to r2.damoang.net (absolute URL)', () => {
        const result = normalizeMediaUrl('https://s3.damoang.net/data/content/img/banner.jpg');
        expect(result).toBe('https://r2.damoang.net/data/content/img/banner.jpg');
    });

    it('keeps s3.damoang.net/data/editor/* on s3 (not yet R2 prefix)', () => {
        const result = normalizeMediaUrl('https://s3.damoang.net/data/editor/2606/abc.webp');
        expect(result).toBe('https://s3.damoang.net/data/editor/2606/abc.webp');
    });

    it('respects custom cdnBaseUrl for non-R2 prefixes', () => {
        const result = normalizeMediaUrl('data/editor/x.webp', 'https://cdn.damoang.net');
        expect(result).toBe('https://cdn.damoang.net/data/editor/x.webp');
    });

    it('overrides cdnBaseUrl with R2 for R2 prefix', () => {
        const result = normalizeMediaUrl('data/content/img/x.png', 'https://cdn.damoang.net');
        expect(result).toBe('https://r2.damoang.net/data/content/img/x.png');
    });

    it('returns null for empty input', () => {
        expect(normalizeMediaUrl(null)).toBe(null);
        expect(normalizeMediaUrl(undefined)).toBe(null);
        expect(normalizeMediaUrl('')).toBe(null);
    });
});

describe('normalizeMediaUrl — 더블슬래시 collapse + CDN 정규화 (#12697)', () => {
    it('메인 도메인 + leading 더블슬래시 → s3 단일슬래시', () => {
        expect(normalizeMediaUrl('https://damoang.net//data/editor/2506/x.jpeg')).toBe(
            'https://s3.damoang.net/data/editor/2506/x.jpeg'
        );
    });

    it('s3 호스트 + 경로 중간 더블슬래시 → 단일슬래시', () => {
        expect(normalizeMediaUrl('https://s3.damoang.net/data/editor/2404//y.jpg')).toBe(
            'https://s3.damoang.net/data/editor/2404/y.jpg'
        );
    });

    it('상대 경로(/data/...) → s3 절대 URL', () => {
        expect(normalizeMediaUrl('/data/editor/x.jpg')).toBe(
            'https://s3.damoang.net/data/editor/x.jpg'
        );
    });

    it('상대 경로 더블슬래시도 collapse', () => {
        expect(normalizeMediaUrl('data/editor/2404//y.jpg')).toBe(
            'https://s3.damoang.net/data/editor/2404/y.jpg'
        );
    });

    it('멱등: 이미 정규화된 s3 단일슬래시 URL 은 그대로', () => {
        const url = 'https://s3.damoang.net/data/editor/x.jpg';
        expect(normalizeMediaUrl(url)).toBe(url);
    });

    it('더블슬래시 + data/content/ 는 r2 라우팅 유지', () => {
        expect(normalizeMediaUrl('https://damoang.net//data/content/z.webp')).toBe(
            'https://r2.damoang.net/data/content/z.webp'
        );
    });

    it('damoang 미디어가 아닌 외부 이미지는 변형하지 않음', () => {
        expect(normalizeMediaUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    });
});

describe('normalizeHtmlMediaUrls — 본문 HTML img src 정규화', () => {
    it('더블슬래시 img src 를 collapse + 재호스팅', () => {
        const html = '<p>x</p><img class="w" src="https://damoang.net//data/editor/2506/x.jpeg">';
        expect(normalizeHtmlMediaUrls(html)).toContain(
            'src="https://s3.damoang.net/data/editor/2506/x.jpeg"'
        );
    });

    it('여러 img 처리, 외부 이미지는 보존', () => {
        const html = '<img src="data/editor/a.jpg"><img src="https://example.com/b.png">';
        const out = normalizeHtmlMediaUrls(html);
        expect(out).toContain('src="https://s3.damoang.net/data/editor/a.jpg"');
        expect(out).toContain('src="https://example.com/b.png"');
    });

    it('정상 URL 만 있으면 변화 없음(멱등)', () => {
        const html = '<img src="https://s3.damoang.net/data/editor/x.jpg">';
        expect(normalizeHtmlMediaUrls(html)).toBe(html);
    });

    it('빈 문자열은 그대로', () => {
        expect(normalizeHtmlMediaUrls('')).toBe('');
    });
});

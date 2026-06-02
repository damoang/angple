import { describe, expect, it } from 'vitest';
import { normalizeMediaUrl } from './media-url';

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

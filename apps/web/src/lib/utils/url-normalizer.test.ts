import { describe, expect, it } from 'vitest';
import { normalizeWebUrl, toRelativeIfSameOrigin } from './url-normalizer';

describe('normalizeWebUrl', () => {
    it('decodes &amp; and upgrades http to https for non-localhost', () => {
        const result = normalizeWebUrl('http://example.com/a?x=1&amp;y=2');
        expect(result).toBe('https://example.com/a?x=1&y=2');
    });

    it('keeps localhost as http', () => {
        const result = normalizeWebUrl('http://localhost:5173/a');
        expect(result).toBe('http://localhost:5173/a');
    });

    it('handles protocol-relative urls', () => {
        const result = normalizeWebUrl('//s3.damoang.net/path/img.webp');
        expect(result).toBe('https://s3.damoang.net/path/img.webp');
    });
});

describe('toRelativeIfSameOrigin', () => {
    it('returns relative path for same origin', () => {
        const result = toRelativeIfSameOrigin(
            'https://damoang.net/free/1?x=1#likes',
            'https://damoang.net'
        );
        expect(result).toBe('/free/1?x=1#likes');
    });

    it('keeps absolute url for different origin', () => {
        const result = toRelativeIfSameOrigin('https://example.com/a', 'https://damoang.net');
        expect(result).toBe('https://example.com/a');
    });
});

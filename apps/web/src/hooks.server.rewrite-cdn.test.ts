import { describe, expect, it } from 'vitest';
import { rewriteCdnToR2 } from './hooks.server';

describe('rewriteCdnToR2 — SSR HTML cdn.damoang.net → r2.damoang.net', () => {
    it('rewrites cdn /data/editor/ URL to r2', () => {
        const html = '<img src="https://cdn.damoang.net/data/editor/2606/abc.webp" />';
        const result = rewriteCdnToR2(html);
        expect(result).toBe('<img src="https://r2.damoang.net/data/editor/2606/abc.webp" />');
    });

    it('rewrites all whitelisted prefixes (content, editor, file, member_image, home, qa, member, nariya)', () => {
        const prefixes = [
            'content/img/logo.png',
            'editor/2606/abc.webp',
            'file/board/xyz.zip',
            'member_image/ad/admin.webp',
            'home/banner.jpg',
            'qa/icon.png',
            'member/profile.png',
            'nariya/cover.webp'
        ];
        for (const p of prefixes) {
            const html = `<a href="https://cdn.damoang.net/data/${p}">x</a>`;
            const expected = `<a href="https://r2.damoang.net/data/${p}">x</a>`;
            expect(rewriteCdnToR2(html)).toBe(expected);
        }
    });

    it('preserves cdn URLs for non-whitelisted prefixes (raw, tmp — R2 dual-write 대상 아님)', () => {
        const html =
            '<img src="https://cdn.damoang.net/data/raw/editor/temp.webp" /><a href="https://cdn.damoang.net/data/tmp/x.png">y</a>';
        expect(rewriteCdnToR2(html)).toBe(html);
    });

    it('preserves cdn URLs for paths outside /data/ (legacy, theme, etc)', () => {
        const html = '<link href="https://cdn.damoang.net/theme/style.css" />';
        expect(rewriteCdnToR2(html)).toBe(html);
    });

    it('rewrites multiple URLs in a single HTML chunk', () => {
        const html = [
            '<img src="https://cdn.damoang.net/data/editor/a.webp" />',
            '<img src="https://cdn.damoang.net/data/member_image/b.webp" />',
            '<img src="https://cdn.damoang.net/data/raw/c.webp" />' // 비대상
        ].join('');
        const result = rewriteCdnToR2(html);
        expect(result).toContain('https://r2.damoang.net/data/editor/a.webp');
        expect(result).toContain('https://r2.damoang.net/data/member_image/b.webp');
        expect(result).toContain('https://cdn.damoang.net/data/raw/c.webp'); // 비대상 보존
        expect(result).not.toContain('https://cdn.damoang.net/data/editor/');
    });

    it('handles http:// (insecure) → https://r2', () => {
        const html = '<img src="http://cdn.damoang.net/data/editor/x.webp">';
        expect(rewriteCdnToR2(html)).toBe('<img src="https://r2.damoang.net/data/editor/x.webp">');
    });

    it('handles URL inside JSON-encoded attribute (escaped quotes)', () => {
        const html =
            '<div data-img="https://cdn.damoang.net/data/editor/escaped.webp">content</div>';
        const result = rewriteCdnToR2(html);
        expect(result).toContain('data-img="https://r2.damoang.net/data/editor/escaped.webp"');
    });

    it('does not modify URLs with similar but different hosts', () => {
        const html = '<a href="https://cdn.damoang.net.evil.com/data/editor/x.webp">x</a>';
        expect(rewriteCdnToR2(html)).toBe(html);
    });

    it('idempotent — running twice produces same result', () => {
        const html = '<img src="https://cdn.damoang.net/data/editor/x.webp" />';
        const once = rewriteCdnToR2(html);
        const twice = rewriteCdnToR2(once);
        expect(once).toBe(twice);
    });

    it('returns empty string unchanged', () => {
        expect(rewriteCdnToR2('')).toBe('');
    });
});

import { describe, expect, it } from 'vitest';
import { isTitleMaskedProxyPath, maskProxyJsonTitles } from './proxy-title-mask';

describe('isTitleMaskedProxyPath', () => {
    it('matches board post/notice lists and my post lists', () => {
        expect(isTitleMaskedProxyPath('boards/free/posts')).toBe(true);
        expect(isTitleMaskedProxyPath('boards/free/posts/')).toBe(true);
        expect(isTitleMaskedProxyPath('boards/free/notices')).toBe(true);
        expect(isTitleMaskedProxyPath('my/posts')).toBe(true);
        expect(isTitleMaskedProxyPath('my/liked-posts')).toBe(true);
    });

    it('never matches a single post (edit/repost must get the raw title)', () => {
        expect(isTitleMaskedProxyPath('boards/free/posts/123')).toBe(false);
        expect(isTitleMaskedProxyPath('boards/free/posts/123/')).toBe(false);
        expect(isTitleMaskedProxyPath('boards/free/posts/123/comments')).toBe(false);
    });

    it('ignores unrelated paths', () => {
        expect(isTitleMaskedProxyPath('boards/free')).toBe(false);
        expect(isTitleMaskedProxyPath('my/comments')).toBe(false);
        expect(isTitleMaskedProxyPath('x/boards/free/posts')).toBe(false);
        expect(isTitleMaskedProxyPath('')).toBe(false);
    });
});

describe('maskProxyJsonTitles', () => {
    it('masks titles inside a list response', () => {
        const text = JSON.stringify({
            data: [{ id: 1, title: '문의 a@b.com', content: 'c@d.com' }],
            meta: { total: 1 }
        });
        const out = JSON.parse(maskProxyJsonTitles(text));
        expect(out.data[0].title).toBe('문의 [이메일]');
        expect(out.data[0].content).toBe('c@d.com');
        expect(out.meta.total).toBe(1);
    });

    it('returns the same text when no address can be present', () => {
        const text = JSON.stringify({ data: [{ title: '평범한 제목' }] });
        expect(maskProxyJsonTitles(text)).toBe(text);
    });

    it('falls back to the original text for invalid JSON', () => {
        expect(maskProxyJsonTitles('not json a@b.com')).toBe('not json a@b.com');
    });
});

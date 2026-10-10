import { describe, expect, it } from 'vitest';
import { isTitleMaskedProxyPath, maskProxyJsonTitles } from './proxy-title-mask';

describe('isTitleMaskedProxyPath', () => {
    it('matches board post/notice lists and my post lists', () => {
        expect(isTitleMaskedProxyPath('boards/free/posts')).toBe(true);
        expect(isTitleMaskedProxyPath('boards/free/posts/')).toBe(true);
        expect(isTitleMaskedProxyPath('boards/free/notices')).toBe(true);
        expect(isTitleMaskedProxyPath('my/posts')).toBe(true);
        expect(isTitleMaskedProxyPath('my/liked-posts')).toBe(true);
        expect(isTitleMaskedProxyPath('my/comments')).toBe(true);
    });

    it('matches display-only feeds, search, member activity and promotion inserts', () => {
        expect(isTitleMaskedProxyPath('recommended/ai/daily')).toBe(true);
        expect(isTitleMaskedProxyPath('recommended/index-widgets')).toBe(true);
        expect(isTitleMaskedProxyPath('recommended')).toBe(true);
        expect(isTitleMaskedProxyPath('popular')).toBe(true);
        expect(isTitleMaskedProxyPath('popular/weekly')).toBe(true);
        expect(isTitleMaskedProxyPath('expose')).toBe(true);
        expect(isTitleMaskedProxyPath('notice')).toBe(true);
        expect(isTitleMaskedProxyPath('search')).toBe(true);
        expect(isTitleMaskedProxyPath('search/autocomplete')).toBe(true);
        expect(isTitleMaskedProxyPath('members/someone/activity')).toBe(true);
        expect(isTitleMaskedProxyPath('promotion/posts/insert')).toBe(true);
    });

    it('never matches a single post (edit/repost must get the raw title)', () => {
        expect(isTitleMaskedProxyPath('boards/free/posts/123')).toBe(false);
        expect(isTitleMaskedProxyPath('boards/free/posts/123/')).toBe(false);
        expect(isTitleMaskedProxyPath('boards/free/posts/123/comments')).toBe(false);
    });

    it('never matches revision history (admin restore/compare needs the original)', () => {
        expect(isTitleMaskedProxyPath('boards/free/posts/123/revisions')).toBe(false);
        expect(isTitleMaskedProxyPath('boards/free/posts/123/revisions/2')).toBe(false);
        expect(isTitleMaskedProxyPath('boards/free/posts/123/comments/5/revisions')).toBe(false);
    });

    it('ignores unrelated paths', () => {
        expect(isTitleMaskedProxyPath('boards/free')).toBe(false);
        expect(isTitleMaskedProxyPath('my/favorites')).toBe(false);
        expect(isTitleMaskedProxyPath('members/someone')).toBe(false);
        expect(isTitleMaskedProxyPath('promotion/settings')).toBe(false);
        expect(isTitleMaskedProxyPath('notices')).toBe(false);
        expect(isTitleMaskedProxyPath('x/boards/free/posts')).toBe(false);
        expect(isTitleMaskedProxyPath('x/recommended/ai/daily')).toBe(false);
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

    it('masks the parent post title in my comment lists', () => {
        const text = JSON.stringify({
            data: [{ id: 7, post_title: '연락처 x@y.org', content: '댓글 z@w.net' }]
        });
        const out = JSON.parse(maskProxyJsonTitles(text));
        expect(out.data[0].post_title).toBe('연락처 [이메일]');
        expect(out.data[0].content).toBe('댓글 z@w.net');
    });

    it('returns the same text when no address can be present', () => {
        const text = JSON.stringify({ data: [{ title: '평범한 제목' }] });
        expect(maskProxyJsonTitles(text)).toBe(text);
    });

    it('falls back to the original text for invalid JSON', () => {
        expect(maskProxyJsonTitles('not json a@b.com')).toBe('not json a@b.com');
    });
});

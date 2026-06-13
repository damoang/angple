import { describe, expect, it } from 'vitest';
import { buildMatchExpr, escapeSphinxMatch, containsCJK } from './sphinx-search.js';

describe('escapeSphinxMatch', () => {
    it('escapes Sphinx special characters', () => {
        expect(escapeSphinxMatch('hello (world)')).toBe('hello \\(world\\)');
        expect(escapeSphinxMatch('a@b')).toBe('a\\@b');
        expect(escapeSphinxMatch('a/b')).toBe('a\\/b');
    });
});

describe('containsCJK', () => {
    it('detects Korean / Chinese / Japanese characters', () => {
        expect(containsCJK('한글')).toBe(true);
        expect(containsCJK('日本語')).toBe(true);
        expect(containsCJK('中文')).toBe(true);
    });

    it('returns false for ASCII-only strings', () => {
        expect(containsCJK('hello world')).toBe(false);
        expect(containsCJK('abc123')).toBe(false);
    });
});

describe('buildMatchExpr — sfl 4-split (작성자/댓글 닉네임/아이디 분리)', () => {
    // 작성자 (글)
    it("'author' (legacy) matches both mb_id and wr_name", () => {
        expect(buildMatchExpr('admin', 'author')).toBe('@(mb_id,wr_name) *admin*');
    });

    it("'author_nick' matches only wr_name", () => {
        expect(buildMatchExpr('SDK', 'author_nick')).toBe('@wr_name *SDK*');
    });

    it("'author_id' matches only mb_id", () => {
        expect(buildMatchExpr('admin', 'author_id')).toBe('@mb_id *admin*');
    });

    // 댓글 작성자
    it("'comment_author' (legacy) matches both mb_id and wr_name", () => {
        expect(buildMatchExpr('admin', 'comment_author')).toBe('@(mb_id,wr_name) *admin*');
    });

    it("'comment_nick' matches only wr_name", () => {
        expect(buildMatchExpr('SDK', 'comment_nick')).toBe('@wr_name *SDK*');
    });

    it("'comment_id' matches only mb_id", () => {
        expect(buildMatchExpr('admin', 'comment_id')).toBe('@mb_id *admin*');
    });

    // 기존 동작 회귀 보호
    it("'title' / 'content' / 'title_content' / 'comment' unchanged", () => {
        expect(buildMatchExpr('foo', 'title')).toBe('@wr_subject *foo*');
        expect(buildMatchExpr('foo', 'content')).toBe('@wr_content *foo*');
        expect(buildMatchExpr('foo', 'title_content')).toBe('@(wr_subject,wr_content) *foo*');
        expect(buildMatchExpr('foo', 'comment')).toBe('@wr_content *foo*');
    });

    it('CJK 2자+ 토큰을 strict phrase로 wrap한다 (#12543 오매칭 방지)', () => {
        // 와일드카드("*한글*")가 아닌 strict phrase("한글") — "산불"이 "생산 불가"에 오매칭되지 않도록
        expect(buildMatchExpr('한글', 'author_nick')).toBe('@wr_name "한글"');
        expect(buildMatchExpr('한글', 'author_id')).toBe('@mb_id "한글"');
    });
});

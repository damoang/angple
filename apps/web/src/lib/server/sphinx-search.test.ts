import { describe, expect, it } from 'vitest';
import {
    buildMatchExpr,
    computeSearchExcludedBoards,
    containsCJK,
    escapeSphinxMatch
} from './sphinx-search.js';

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

describe('computeSearchExcludedBoards — 검색 제외 게시판', () => {
    const settings = [
        { bo_table: 'free', bo_use_search: 1, bo_read_level: 1 },
        { bo_table: 'hidden', bo_use_search: 0, bo_read_level: 1 },
        { bo_table: 'members_only', bo_use_search: 1, bo_read_level: 2 },
        { bo_table: 'staff_only', bo_use_search: 1, bo_read_level: 5 },
        { bo_table: 'admin_only', bo_use_search: 1, bo_read_level: 10 }
    ];

    it('검색 사용 안 함 게시판은 레벨과 무관하게 뺀다', () => {
        expect(computeSearchExcludedBoards(settings, 10)).toEqual(['hidden']);
    });

    it('검색이 켜져 있어도 읽을 수 없는 게시판은 뺀다', () => {
        expect(computeSearchExcludedBoards(settings, 2)).toEqual([
            'hidden',
            'staff_only',
            'admin_only'
        ]);
        expect(computeSearchExcludedBoards(settings, 4)).toEqual([
            'hidden',
            'staff_only',
            'admin_only'
        ]);
        expect(computeSearchExcludedBoards(settings, 5)).toEqual(['hidden', 'admin_only']);
    });

    it('비회원 레벨(1)이면 회원 전용 게시판도 뺀다', () => {
        expect(computeSearchExcludedBoards(settings, 1)).toEqual([
            'hidden',
            'members_only',
            'staff_only',
            'admin_only'
        ]);
    });

    it('읽기 레벨이 낮아도 목록 레벨이 사용자보다 높으면 뺀다', () => {
        const listGated = [
            { bo_table: 'list_gated', bo_use_search: 1, bo_read_level: 1, bo_list_level: 5 }
        ];
        expect(computeSearchExcludedBoards(listGated, 2)).toEqual(['list_gated']);
        expect(computeSearchExcludedBoards(listGated, 5)).toEqual([]);
    });

    it('SQL 에 넣을 수 없는 이름은 걸러낸다', () => {
        expect(
            computeSearchExcludedBoards(
                [{ bo_table: "x'y", bo_use_search: 0, bo_read_level: 1 }],
                1
            )
        ).toEqual([]);
    });
});

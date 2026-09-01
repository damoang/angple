import { describe, it, expect } from 'vitest';
import { extractMentions, highlightMentions } from './mention-parser';

describe('extractMentions', () => {
    it('extracts @nick from plain text', () => {
        const result = extractMentions('hello @alice and @bob');
        expect(result).toEqual(['alice', 'bob']);
    });

    it('deduplicates repeated mentions', () => {
        const result = extractMentions('@alice @alice @bob');
        expect(result).toEqual(['alice', 'bob']);
    });

    it('extracts from data-mention attribute in HTML', () => {
        const html = '<span data-type="mention" data-mention="charlie">@charlie</span>';
        expect(extractMentions(html)).toEqual(['charlie']);
    });

    it('ignores @ inside URLs and emails', () => {
        const result = extractMentions(
            'email me at user@example.com or visit https://x.com/u@page'
        );
        expect(result).toEqual([]);
    });

    it('supports Korean nicknames', () => {
        const result = extractMentions('@홍길동 안녕');
        expect(result).toEqual(['홍길동']);
    });

    it('returns empty array for empty input', () => {
        expect(extractMentions('')).toEqual([]);
    });

    // ── lookbehind → 경계그룹 재작성(iOS<16.4) 회귀 방지 ──
    it('does not match short email like a@b.com', () => {
        expect(extractMentions('a@b.com')).toEqual([]);
    });

    it('extracts both adjacent mentions @kim @lee', () => {
        expect(extractMentions('@kim @lee')).toEqual(['kim', 'lee']);
    });

    it('extracts only the first in @a@b (second @ has no boundary)', () => {
        expect(extractMentions('@a@b')).toEqual(['a']);
    });

    it('matches a leading mention @a (start-of-string boundary)', () => {
        expect(extractMentions('@a hello')).toEqual(['a']);
    });
});

describe('highlightMentions', () => {
    it('wraps @nick with anchor pointing to /member/<nick> (regression #9266)', () => {
        const result = highlightMentions('hi @alice');
        expect(result).toContain('href="/member/alice"');
        expect(result).toContain('data-mention="alice"');
        expect(result).toContain('>@alice<');
    });

    it('does NOT use the legacy /profile/ route (regression #9266)', () => {
        const result = highlightMentions('@alice');
        expect(result).not.toContain('/profile/');
        expect(result).not.toContain('href="/profile');
    });

    it('encodes Korean nicknames safely', () => {
        const result = highlightMentions('안녕 @홍길동');
        // encodeURIComponent("홍길동") === "%ED%99%8D%EA%B8%B8%EB%8F%99"
        expect(result).toContain(`href="/member/${encodeURIComponent('홍길동')}"`);
        // data-mention keeps the raw nickname for downstream consumers
        expect(result).toContain('data-mention="홍길동"');
    });

    it('does not transform @ inside email/URL', () => {
        const input = 'mail user@example.com';
        const result = highlightMentions(input);
        expect(result).toBe(input);
    });

    it('does not transform @ inside HTML tags', () => {
        const input = '<a href="mailto:foo@bar.com">@inside</a> @outside';
        const result = highlightMentions(input);
        // tag content untouched
        expect(result).toContain('mailto:foo@bar.com');
        // outside the tag is wrapped
        expect(result).toContain('href="/member/outside"');
    });

    it('returns input untouched when no mentions present', () => {
        expect(highlightMentions('plain text')).toBe('plain text');
    });

    it('returns empty string for empty input', () => {
        expect(highlightMentions('')).toBe('');
    });

    // ── 경계문자 보존: 경계그룹 재작성 시 앞글자 유실 없어야 함 ──
    it('keeps the leading boundary char before a mention (no char loss)', () => {
        const result = highlightMentions('a @kim');
        // 앞의 "a " 가 유실되지 않아야 한다
        expect(result.startsWith('a ')).toBe(true);
        expect(result).toContain('href="/member/kim"');
    });

    it('wraps a mention at the very start of the string', () => {
        const result = highlightMentions('@kim hello');
        expect(result.startsWith('<a ')).toBe(true);
        expect(result).toContain('href="/member/kim"');
        expect(result).toContain(' hello');
    });
});

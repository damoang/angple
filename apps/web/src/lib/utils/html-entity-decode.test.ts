/**
 * HTML 엔티티 디코딩 보안 수정 테스트
 * #69, #70 - Double escaping/unescaping (amazon, kkday)
 * #71, #65 - Incomplete multi-character sanitization (new-posts, activity)
 *
 * 실제 모듈은 서버 전용($env 등)이므로 동일한 패턴을 직접 테스트
 */
import { describe, it, expect } from 'vitest';

// --- 제휴 링크용 엔티티 디코딩 (amazon.ts, kkday.ts에서 사용하는 패턴) ---
function decodeAffiliateEntities(url: string): string {
    const entityMap: Record<string, string> = { '&amp;': '&', '&#x3D;': '=', '&#x26;': '&' };
    return url.replace(/&amp;|&#x3D;|&#x26;/g, (m) => entityMap[m]);
}

// --- 콘텐츠 미리보기용 엔티티 디코딩 (new-posts.ts, activity/+server.ts에서 사용하는 패턴) ---
function decodeContentEntities(text: string): string {
    const entityMap: Record<string, string> = {
        '&nbsp;': ' ',
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&'
    };
    return text.replace(/&(?:nbsp|lt|gt|amp);/g, (m) => entityMap[m]);
}

describe('제휴 링크 엔티티 디코딩 (단일 패스)', () => {
    it('기본 &amp; 디코딩', () => {
        expect(decodeAffiliateEntities('foo&amp;bar')).toBe('foo&bar');
    });

    it('&#x3D; 디코딩', () => {
        expect(decodeAffiliateEntities('key&#x3D;value')).toBe('key=value');
    });

    it('&#x26; 디코딩', () => {
        expect(decodeAffiliateEntities('a&#x26;b')).toBe('a&b');
    });

    it('이중 인코딩된 엔티티는 한 번만 디코딩 (이중 언이스케이프 방지)', () => {
        // &amp;amp; → &amp; (한 번만 디코딩, & 로 되면 안 됨)
        expect(decodeAffiliateEntities('&amp;amp;')).toBe('&amp;');
    });

    it('&amp;#x3D; 이중 인코딩 방지', () => {
        // &amp;#x3D; → &#x3D; (= 로 되면 안 됨)
        expect(decodeAffiliateEntities('&amp;#x3D;')).toBe('&#x3D;');
    });

    it('복합 URL 정상 디코딩', () => {
        const input = 'https://amazon.com/dp/B001?tag&#x3D;test&amp;ref&#x3D;home';
        const expected = 'https://amazon.com/dp/B001?tag=test&ref=home';
        expect(decodeAffiliateEntities(input)).toBe(expected);
    });

    it('엔티티 없는 URL은 그대로 반환', () => {
        const url = 'https://amazon.com/dp/B001?tag=test&ref=home';
        expect(decodeAffiliateEntities(url)).toBe(url);
    });

    it('빈 문자열 처리', () => {
        expect(decodeAffiliateEntities('')).toBe('');
    });

    it('3중 인코딩 &amp;amp;amp; 는 한 단계만 디코딩', () => {
        expect(decodeAffiliateEntities('&amp;amp;amp;')).toBe('&amp;amp;');
    });

    it('&#x26;amp; 이중 인코딩 방지 (&#x26; → & 후 &amp; 재생성 안 됨)', () => {
        // 단일 패스이므로 &#x26; → & 변환 후 amp; 가 남아 &amp;로 재결합되지 않음
        expect(decodeAffiliateEntities('&#x26;amp;')).toBe('&amp;');
    });
});

describe('콘텐츠 미리보기 엔티티 디코딩 (단일 패스)', () => {
    it('기본 엔티티 디코딩', () => {
        expect(decodeContentEntities('1 &lt; 2 &amp; 3 &gt; 0')).toBe('1 < 2 & 3 > 0');
    });

    it('&nbsp; 를 공백으로 변환', () => {
        expect(decodeContentEntities('hello&nbsp;world')).toBe('hello world');
    });

    it('이중 인코딩된 &amp;lt; 는 한 번만 디코딩 (XSS 방지)', () => {
        // &amp;lt; → &lt; (< 로 되면 안 됨)
        expect(decodeContentEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
    });

    it('&amp;amp; 이중 디코딩 방지', () => {
        expect(decodeContentEntities('&amp;amp;')).toBe('&amp;');
    });

    it('엔티티 없는 텍스트는 그대로 반환', () => {
        expect(decodeContentEntities('hello world')).toBe('hello world');
    });

    it('혼합 엔티티 정상 처리', () => {
        expect(decodeContentEntities('A&amp;B &lt;C&gt; D&nbsp;E')).toBe('A&B <C> D E');
    });

    it('빈 문자열 처리', () => {
        expect(decodeContentEntities('')).toBe('');
    });

    it('3중 인코딩 &amp;amp;lt; 는 한 단계만 디코딩', () => {
        expect(decodeContentEntities('&amp;amp;lt;')).toBe('&amp;lt;');
    });

    it('연속된 엔티티 정상 처리', () => {
        expect(decodeContentEntities('&lt;&gt;&amp;&nbsp;')).toBe('<>& ');
    });

    it('부분 매칭은 무시 (&am 등 불완전한 엔티티)', () => {
        expect(decodeContentEntities('&am test &lt')).toBe('&am test &lt');
    });
});

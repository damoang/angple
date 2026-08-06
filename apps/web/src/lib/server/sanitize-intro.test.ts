import { describe, expect, it } from 'vitest';
import { sanitizeIntroHtml } from './sanitize';

describe('sanitizeIntroHtml', () => {
    it('기본 서식과 이미지는 살린다', () => {
        const out = sanitizeIntroHtml(
            '<p>매주 <b>수요일</b> 모임</p><img src="https://cdn.damoang.net/a.png" alt="포스터">'
        );
        expect(out).toContain('<b>수요일</b>');
        expect(out).toContain('<img');
    });

    it('script·이벤트 핸들러·javascript URL 제거', () => {
        expect(sanitizeIntroHtml('<script>alert(1)</script><p>안녕</p>')).not.toContain('script');
        expect(
            sanitizeIntroHtml('<img src="https://a.com/x.png" onerror="alert(1)">')
        ).not.toContain('onerror');
        expect(sanitizeIntroHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
            'javascript:'
        );
    });

    it('구글 캘린더 iframe 은 살리고, 그 외 iframe 은 제거', () => {
        const cal =
            '<iframe src="https://calendar.google.com/calendar/embed?src=abc" width="100%" height="400"></iframe>';
        expect(sanitizeIntroHtml(cal)).toContain('calendar.google.com');
        expect(
            sanitizeIntroHtml('<iframe src="https://evil.example.com/x"></iframe>')
        ).not.toContain('iframe');
        // 유튜브도 intro 에서는 불허 (게시글 본문과 다른 정책)
        expect(
            sanitizeIntroHtml('<iframe src="https://www.youtube.com/embed/xyz"></iframe>')
        ).not.toContain('iframe');
    });

    it('http(비암호화) 이미지 제거', () => {
        expect(sanitizeIntroHtml('<img src="http://a.com/x.png">')).not.toContain('http://a.com');
    });
});

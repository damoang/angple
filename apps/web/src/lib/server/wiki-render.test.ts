import { describe, expect, it } from 'vitest';
import {
    normalizeWikiContentType,
    prepareWikiContentForSave,
    renderWikiContent
} from './wiki-render';
import { sanitizePostContentStrict } from './sanitize';

describe('renderWikiContent — html 본문', () => {
    it('script 태그를 제거한다', () => {
        const out = renderWikiContent('<p>안녕</p><script>alert(1)</script>', 'html');
        expect(out).toContain('<p>안녕</p>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('alert(1)');
    });

    it('이벤트 핸들러 속성을 제거한다', () => {
        const out = renderWikiContent(
            '<img src="https://cdn.example.com/a.png" onerror="alert(1)">',
            'html'
        );
        expect(out).toContain('src="https://cdn.example.com/a.png"');
        expect(out).not.toContain('onerror');
    });

    it('javascript: 링크를 제거한다', () => {
        const out = renderWikiContent('<a href="javascript:alert(1)">링크</a>', 'html');
        expect(out).toContain('링크');
        expect(out).not.toContain('javascript:');
    });

    it('허용 외 도메인 iframe 은 제거하고 유튜브는 남긴다', () => {
        expect(
            renderWikiContent('<iframe src="https://evil.example.com/x"></iframe>', 'html')
        ).not.toContain('iframe');
        expect(
            renderWikiContent(
                '<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>',
                'html'
            )
        ).toContain('youtube.com/embed/abc');
    });

    it('일반 서식(제목·표·코드·링크·이미지)은 남긴다', () => {
        const html =
            '<h2>제목</h2>' +
            '<table><thead><tr><th>열</th></tr></thead><tbody><tr><td colspan="2">값</td></tr></tbody></table>' +
            '<pre><code>const a = 1;</code></pre>' +
            '<a href="https://damoang.net/free">다모앙</a>' +
            '<img src="https://cdn.example.com/b.png" alt="그림">';
        const out = renderWikiContent(html, 'html');
        expect(out).toContain('<h2>제목</h2>');
        expect(out).toContain('<table>');
        expect(out).toContain('<th>열</th>');
        expect(out).toContain('colspan="2"');
        expect(out).toContain('<pre><code>const a = 1;</code></pre>');
        expect(out).toContain('href="https://damoang.net/free"');
        expect(out).toContain('alt="그림"');
    });

    it('게시글 정화 함수와 같은 결과를 낸다', () => {
        const html = '<p style="color: red">본문</p><div onclick="x()">블록</div>';
        expect(renderWikiContent(html, 'html')).toBe(sanitizePostContentStrict(html));
    });

    it('형식이 없거나 wikitext 여도 정화한다', () => {
        expect(renderWikiContent('<script>alert(1)</script>본문', null)).not.toContain('<script');
        expect(renderWikiContent('<script>alert(1)</script>본문', 'wikitext')).not.toContain(
            '<script'
        );
    });

    it('빈 본문은 빈 문자열', () => {
        expect(renderWikiContent('', 'html')).toBe('');
        expect(renderWikiContent(null, 'markdown')).toBe('');
        expect(renderWikiContent(undefined, undefined)).toBe('');
    });
});

describe('renderWikiContent — markdown 본문', () => {
    it('markdown 안의 raw HTML script·이벤트 핸들러를 제거한다', () => {
        const md =
            '# 제목\n\n<script>alert(1)</script>\n\n<img src="https://cdn.example.com/c.png" onerror="alert(2)">\n';
        const out = renderWikiContent(md, 'markdown');
        expect(out).toContain('<h1>제목</h1>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('onerror');
        expect(out).toContain('src="https://cdn.example.com/c.png"');
    });

    it('markdown javascript: 링크를 제거한다', () => {
        const out = renderWikiContent('[눌러](javascript:alert(1))', 'markdown');
        expect(out).toContain('눌러');
        expect(out).not.toMatch(/href=["']?\s*javascript:/i);
    });

    it('일반 서식(제목·표·코드·링크·이미지)은 남긴다', () => {
        const md = [
            '## 소제목',
            '',
            '| 이름 | 값 |',
            '| --- | --- |',
            '| a | 1 |',
            '',
            '```',
            'const a = 1;',
            '```',
            '',
            '[다모앙](https://damoang.net/free)',
            '',
            '![그림](https://cdn.example.com/d.png)'
        ].join('\n');
        const out = renderWikiContent(md, 'markdown');
        expect(out).toContain('<h2>소제목</h2>');
        expect(out).toContain('<table>');
        expect(out).toContain('<td>a</td>');
        expect(out).toContain('<pre><code>const a = 1;');
        expect(out).toContain('href="https://damoang.net/free"');
        expect(out).toContain('src="https://cdn.example.com/d.png"');
        expect(out).toContain('alt="그림"');
    });

    it('줄바꿈은 <br> 로 (breaks 옵션)', () => {
        expect(renderWikiContent('첫 줄\n둘째 줄', 'markdown')).toContain('<br>');
    });
});

describe('prepareWikiContentForSave', () => {
    it('html 본문은 정화해서 저장한다', () => {
        const out = prepareWikiContentForSave(
            '<p>본문</p><script>alert(1)</script><img src="https://a.example.com/x.png" onerror="y()">',
            'html'
        );
        expect(out).toContain('<p>본문</p>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('onerror');
    });

    it('markdown 원문은 문법 기호를 보존한 채 그대로 저장한다', () => {
        const md = '> 인용\n\n<b>굵게</b>';
        expect(prepareWikiContentForSave(md, 'markdown')).toBe(md);
    });

    it('문자열이 아니거나 비면 빈 문자열', () => {
        expect(prepareWikiContentForSave('', 'html')).toBe('');
        expect(prepareWikiContentForSave(undefined, 'html')).toBe('');
        expect(prepareWikiContentForSave({ a: 1 }, 'html')).toBe('');
    });
});

describe('normalizeWikiContentType', () => {
    it('허용 값은 그대로, 그 외는 html', () => {
        expect(normalizeWikiContentType('markdown')).toBe('markdown');
        expect(normalizeWikiContentType('html')).toBe('html');
        expect(normalizeWikiContentType('wikitext')).toBe('wikitext');
        expect(normalizeWikiContentType('svg')).toBe('html');
        expect(normalizeWikiContentType(undefined)).toBe('html');
        expect(normalizeWikiContentType(1)).toBe('html');
    });
});

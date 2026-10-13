import { describe, expect, it } from 'vitest';
import { renderWiki } from './render';
import { canonicalWikiPath, validateWikiPath } from './paths';
describe('wiki reading and editing', () => {
    it('renders tables, Korean wiki links and literal code without executing HTML', () => {
        const result = renderWiki(
            '## 제목\n\n[[다모앙|이동]]\n\n`[[코드]]`\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<img src=x onerror="alert(1)"><script>alert(2)</script>'
        );
        expect(result.html).toContain('wiki-table-scroll');
        expect(result.html).toContain('href="/%EB%8B%A4%EB%AA%A8%EC%95%99"');
        expect(result.html).toContain('<code>[[코드]]</code>');
        expect(result.html).not.toMatch(/onerror|<script/);
        expect(result.headings).toEqual([{ level: 2, text: '제목', slug: '제목' }]);
    });
    it('preserves HTML table spans and generates matching unique headings', () => {
        const result = renderWiki(
            '<h2><strong>같은 제목</strong></h2><h2>같은 제목</h2><table><tr><td colspan="2">내용</td></tr></table>',
            'html'
        );
        expect(result.html).toContain('colspan="2"');
        expect(result.headings.map((h) => h.slug)).toEqual(['같은-제목', '같은-제목-2']);
        expect(result.html).toContain('id="같은-제목-2"');
    });
    it('clears the preview for empty content and escapes unsafe targets', () => {
        expect(renderWiki('').html).toBe('');
        expect(renderWiki('[[a" onclick="alert(1)|<img src=x onerror=x>]]').html).not.toContain(
            'onclick="'
        );
    });
    it('supports old community links and Korean navigation aliases', () => {
        expect(canonicalWikiPath('/w/다모앙')).toBe('/%EB%8B%A4%EB%AA%A8%EC%95%99');
        expect(canonicalWikiPath('/wiki/특수:최근바뀜')).toBe('/Special%3ARecentChanges');
        expect(validateWikiPath('api/wiki/pages')).toBeNull();
        expect(validateWikiPath('문서/../다른문서')).toBeNull();
        expect(validateWikiPath('새 문서')).toBe('/새 문서');
    });
});

import { describe, it, expect } from 'vitest';
import { stripBlobMedia } from './strip-blob-media.js';

describe('stripBlobMedia', () => {
    it('blob: 없는 본문은 그대로 반환', () => {
        const html = '<p>hello</p><img src="https://cdn.damoang.net/data/editor/2607/a.webp">';
        expect(stripBlobMedia(html)).toBe(html);
    });

    it('빈 문자열은 그대로 반환', () => {
        expect(stripBlobMedia('')).toBe('');
    });

    it('blob: img 태그 제거, 정상 img 는 유지', () => {
        const html =
            '<p>글</p><img src="blob:https://damoang.net/abc-123"><img src="https://cdn.damoang.net/data/editor/2607/a.webp"><p>끝</p>';
        expect(stripBlobMedia(html)).toBe(
            '<p>글</p><img src="https://cdn.damoang.net/data/editor/2607/a.webp"><p>끝</p>'
        );
    });

    it('src 앞에 다른 속성이 있어도 제거', () => {
        const html = '<img class="x" alt="사진" src="blob:https://damoang.net/abc" width="100">';
        expect(stripBlobMedia(html)).toBe('');
    });

    it('작은따옴표 src 도 제거', () => {
        expect(stripBlobMedia("<img src='blob:https://damoang.net/abc'>")).toBe('');
    });

    it('self-closing img 제거', () => {
        expect(stripBlobMedia('<img src="blob:https://damoang.net/abc" />')).toBe('');
    });

    it('blob: video 태그(닫는 태그 포함) 제거', () => {
        const html =
            '<p>a</p><video src="blob:https://damoang.net/v1" controls playsinline></video><p>b</p>';
        expect(stripBlobMedia(html)).toBe('<p>a</p><p>b</p>');
    });

    it('마크다운 blob 이미지 제거', () => {
        const md = '본문\n\n![사진](blob:https://damoang.net/abc-123)\n\n끝';
        expect(stripBlobMedia(md)).toBe('본문\n\n\n\n끝');
    });

    it('마크다운 정상 이미지는 유지', () => {
        const md = '![사진](https://cdn.damoang.net/data/editor/2607/a.webp)';
        expect(stripBlobMedia(md)).toBe(md);
    });

    it('blob 이미지 여러 개 전부 제거', () => {
        const html =
            '<img src="blob:https://damoang.net/1"><p>중간</p><img src="blob:https://damoang.net/2">';
        expect(stripBlobMedia(html)).toBe('<p>중간</p>');
    });

    it('본문 텍스트에 blob: 단어가 있어도 태그가 아니면 유지', () => {
        const html = '<p>blob: URL 이란 무엇인가</p>';
        expect(stripBlobMedia(html)).toBe(html);
    });
});

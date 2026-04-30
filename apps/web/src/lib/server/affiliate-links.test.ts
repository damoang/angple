import { describe, expect, it } from 'vitest';
import { linkifyPlainTextUrls } from './affiliate-links';

/**
 * #12175 회귀 테스트 — `linkifyPlainTextUrls` 의 자동 링크 변환이
 * 한글/CJK 문자를 URL 본문으로 흡수하지 않아야 한다.
 *
 * 원래 정규식 `(?:www\.)[^\s<>"']+` 는 negation 클래스에 한글이 포함되어
 * "www.여기는도메인주소가들어갑니다" 같은 입력 전체를 한 URL 로 매칭하던 버그.
 */
describe('linkifyPlainTextUrls', () => {
    it('does not absorb Korean characters following www.', () => {
        const input = '예: 어쩌구 저쩌구 www.여기는도메인주소가들어갑니다 어쩌구저쩌구';
        const output = linkifyPlainTextUrls(input);

        // 한글이 흡수된 가짜 URL 로 <a> 태그가 생성되어선 안 됨
        expect(output).not.toContain('href="https://www.여기는도메인주소가들어갑니다"');
        expect(output).not.toContain('>www.여기는도메인주소가들어갑니다<');
        // 입력 텍스트 자체는 보존
        expect(output).toContain('www.여기는도메인주소가들어갑니다');
    });

    it('does not absorb Korean after partial www. prefix', () => {
        const input = '"www.여기는 도메인  주소가들어갑니다"';
        const output = linkifyPlainTextUrls(input);

        // www.여기는 도 링크가 되면 안 됨
        expect(output).not.toMatch(/<a [^>]*href="https:\/\/www\.여기는/);
    });

    it('still converts plain ASCII www. domains', () => {
        const output = linkifyPlainTextUrls('방문하세요 www.example.com 감사합니다');
        expect(output).toContain('href="https://www.example.com"');
        expect(output).toContain('>www.example.com<');
    });

    it('still converts https:// URLs', () => {
        const output = linkifyPlainTextUrls('방문하세요 https://www.naver.com 감사합니다');
        expect(output).toContain('href="https://www.naver.com"');
    });

    it('marks damoang.net links without target=_blank', () => {
        const output = linkifyPlainTextUrls('https://damoang.net/free 보세요');
        expect(output).toContain('href="https://damoang.net/free"');
        expect(output).not.toMatch(/href="https:\/\/damoang\.net\/free"[^>]*target="_blank"/);
    });

    it('marks external links with target=_blank rel=noopener', () => {
        const output = linkifyPlainTextUrls('https://example.com 보세요');
        expect(output).toContain('target="_blank"');
        expect(output).toContain('rel="noopener noreferrer"');
    });

    it('handles ASCII domain followed by Korean without absorbing Korean', () => {
        const input = 'example.com한글이어붙은';
        const output = linkifyPlainTextUrls(input);
        // 한글이 URL 의 path 로 들어가면 안 됨
        expect(output).not.toContain('href="https://example.com한글이어붙은"');
    });

    it('does not linkify inside existing <a> tags', () => {
        const input = '<a href="https://example.com">www.naver.com</a>';
        const output = linkifyPlainTextUrls(input);
        // 기존 anchor 안의 텍스트는 추가 변환되면 안 됨
        const anchorOpenCount = (output.match(/<a\s/gi) || []).length;
        expect(anchorOpenCount).toBe(1);
    });

    it('strips trailing punctuation from matched URL', () => {
        const output = linkifyPlainTextUrls('보세요 https://example.com.');
        // 마지막 . 는 URL 에서 제외되어야 함
        expect(output).toContain('href="https://example.com"');
        expect(output).toMatch(/<\/a>\.\s*$/);
    });
});

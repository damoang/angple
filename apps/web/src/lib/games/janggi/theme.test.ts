/**
 * 색 토큰 — 보드에 있던 값 그대로 옮겨졌는지(보드 모양 회귀 방지)
 */
import { describe, it, expect } from 'vitest';
import { JANGGI_TOKENS, JANGGI_TOKEN_STYLE } from './theme';

describe('JANGGI_TOKENS', () => {
    it('보드 기존 값과 같다', () => {
        expect(JANGGI_TOKENS['--jb-wood-a']).toBe('#efcf98');
        expect(JANGGI_TOKENS['--jb-face-a']).toBe('#fcf4e1');
        expect(JANGGI_TOKENS['--jb-face-b']).toBe('#e6cc9c');
        expect(JANGGI_TOKENS['--jb-cho']).toBe('#0e5566');
        expect(JANGGI_TOKENS['--jb-han']).toBe('#c2371d');
        expect(JANGGI_TOKENS['--jb-check']).toBe('#dc2626');
        expect(Object.keys(JANGGI_TOKENS)).toHaveLength(23);
    });

    it('style 문자열은 「이름: 값」을 ; 로 잇는다', () => {
        expect(JANGGI_TOKEN_STYLE.startsWith('--jb-wood-a: #efcf98; ')).toBe(true);
        expect(JANGGI_TOKEN_STYLE).toContain('--jb-shine: rgba(255, 255, 255, 0.8)');
        expect(JANGGI_TOKEN_STYLE.split('; ')).toHaveLength(23);
    });
});

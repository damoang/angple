import { describe, it, expect } from 'vitest';
import { contentFormatRegistry } from './content-format-registry';

describe('contentFormatRegistry', () => {
    it("미등록 board_type 은 기본 'html'", () => {
        expect(contentFormatRegistry.resolve('some-unregistered-board')).toBe('html');
    });

    it("undefined/null/'' 은 'html'", () => {
        expect(contentFormatRegistry.resolve(undefined)).toBe('html');
        expect(contentFormatRegistry.resolve(null)).toBe('html');
        expect(contentFormatRegistry.resolve('')).toBe('html');
    });

    it('등록한 board_type 은 해당 형식 반환 (wiki → markdown)', () => {
        contentFormatRegistry.register('cf-test-wiki', 'markdown', 'plugin');
        expect(contentFormatRegistry.resolve('cf-test-wiki')).toBe('markdown');
    });

    it('plugin 등록이 core 등록을 오버라이드', () => {
        contentFormatRegistry.register('cf-test-override', 'markdown', 'plugin');
        // core 가 나중에 html 로 등록해도 plugin 우선
        contentFormatRegistry.register('cf-test-override', 'html', 'core');
        expect(contentFormatRegistry.resolve('cf-test-override')).toBe('markdown');
    });

    it('removeBySource 로 plugin 등록 제거 → 기본값 복귀', () => {
        contentFormatRegistry.register('cf-test-remove', 'markdown', 'plugin');
        expect(contentFormatRegistry.resolve('cf-test-remove')).toBe('markdown');
        contentFormatRegistry.removeBySource('plugin');
        expect(contentFormatRegistry.resolve('cf-test-remove')).toBe('html');
    });
});

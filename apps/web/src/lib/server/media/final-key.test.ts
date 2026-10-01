import { describe, expect, it } from 'vitest';
import { rawKeyToFinalKey } from './final-key';

describe('rawKeyToFinalKey', () => {
    const converted = { converted: true };

    it('raw/ 를 data/ 로 바꾼다', () => {
        expect(rawKeyToFinalKey('raw/editor/2610/abc1234.jpg', converted)).toBe(
            'data/editor/2610/abc1234.jpg'
        );
    });

    it('mp4 로 변환되는 영상은 최종 키의 확장자가 mp4 다', () => {
        for (const ext of ['.mov', '.avi', '.mkv', '.3gp', '.flv']) {
            expect(rawKeyToFinalKey(`raw/editor/2610/abc1234${ext}`, converted)).toBe(
                'data/editor/2610/abc1234.mp4'
            );
        }
    });

    it('확장자 대소문자를 가리지 않는다', () => {
        expect(rawKeyToFinalKey('raw/editor/2610/abc1234.MOV', converted)).toBe(
            'data/editor/2610/abc1234.mp4'
        );
    });

    it('그대로 저장되는 형식은 확장자를 바꾸지 않는다', () => {
        for (const ext of ['.mp4', '.webm', '.m4v', '.wmv', '.gif', '.png', '.pdf']) {
            expect(rawKeyToFinalKey(`raw/editor/2610/abc1234${ext}`, converted)).toBe(
                `data/editor/2610/abc1234${ext}`
            );
        }
    });

    it('포스터 키는 jpg 그대로다', () => {
        expect(rawKeyToFinalKey('raw/editor/2610/abc1234_poster.jpg', converted)).toBe(
            'data/editor/2610/abc1234_poster.jpg'
        );
    });

    it('마지막 확장자만 본다', () => {
        expect(rawKeyToFinalKey('raw/editor/2610/a.mov.png', converted)).toBe(
            'data/editor/2610/a.mov.png'
        );
    });

    it('직접 업로드 모드는 올린 확장자 그대로다 — 변환이 없다', () => {
        expect(rawKeyToFinalKey('raw/editor/2610/abc1234.mov', { converted: false })).toBe(
            'data/editor/2610/abc1234.mov'
        );
    });
});

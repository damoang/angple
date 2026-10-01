import { describe, expect, it } from 'vitest';
import {
    CONVERTED_VIDEO_WAIT_MS,
    DEFAULT_PROCESS_WAIT_MS,
    processWaitMs,
    rawKeyToFinalKey
} from './final-key';

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

describe('processWaitMs', () => {
    it('mp4 로 재인코딩되는 영상은 더 오래 기다린다', () => {
        for (const ext of ['.mov', '.avi', '.mkv', '.3gp', '.flv', '.MOV']) {
            expect(processWaitMs(`raw/editor/2610/abc1234${ext}`, { converted: true })).toBe(
                CONVERTED_VIDEO_WAIT_MS
            );
        }
    });

    it('그대로 저장되는 형식은 기본 한도다', () => {
        for (const ext of ['.mp4', '.webm', '.jpg', '.gif', '.pdf']) {
            expect(processWaitMs(`raw/editor/2610/abc1234${ext}`, { converted: true })).toBe(
                DEFAULT_PROCESS_WAIT_MS
            );
        }
    });

    it('직접 업로드 모드는 변환이 없으므로 기본 한도다', () => {
        expect(processWaitMs('raw/editor/2610/abc1234.mov', { converted: false })).toBe(
            DEFAULT_PROCESS_WAIT_MS
        );
    });

    it('긴 한도도 앞단 프록시의 응답 대기 제한(60초)보다 충분히 짧다', () => {
        expect(CONVERTED_VIDEO_WAIT_MS).toBeGreaterThan(DEFAULT_PROCESS_WAIT_MS);
        expect(CONVERTED_VIDEO_WAIT_MS).toBeLessThanOrEqual(45_000);
    });
});

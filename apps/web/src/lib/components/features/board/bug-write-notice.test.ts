import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    isBugNoticeSkipped,
    setBugNoticeSkip,
    BUG_NOTICE_SKIP_KEY,
    BUG_NOTICE_SKIP_WINDOW_MS,
    BUG_TEMPLATE_CONTENT
} from './bug-write-notice.js';

/** 간단한 in-memory localStorage 목. */
function mockStorage(initial: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(initial));
    return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear()
    };
}

describe('bug-write-notice 스킵 헬퍼', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', mockStorage());
    });

    it('저장값이 없으면 스킵하지 않는다(안내 표시)', () => {
        expect(isBugNoticeSkipped()).toBe(false);
    });

    it('24시간 이내 저장이면 스킵한다', () => {
        const now = 1_000_000_000_000;
        setBugNoticeSkip(now);
        // 23시간 59분 뒤: 아직 스킵 유효
        expect(isBugNoticeSkipped(now + BUG_NOTICE_SKIP_WINDOW_MS - 60_000)).toBe(true);
    });

    it('24시간이 지나면 다시 안내를 표시한다', () => {
        const now = 1_000_000_000_000;
        setBugNoticeSkip(now);
        expect(isBugNoticeSkipped(now + BUG_NOTICE_SKIP_WINDOW_MS + 1)).toBe(false);
    });

    it('저장값이 숫자가 아니면 안내를 표시한다', () => {
        localStorage.setItem(BUG_NOTICE_SKIP_KEY, 'not-a-number');
        expect(isBugNoticeSkipped()).toBe(false);
    });

    it('localStorage 접근이 실패해도 예외 없이 false를 반환한다', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('access denied');
            },
            setItem: () => {
                throw new Error('access denied');
            }
        });
        expect(isBugNoticeSkipped()).toBe(false);
        // 저장 실패도 조용히 무시되어야 한다
        expect(() => setBugNoticeSkip()).not.toThrow();
    });

    it('본문 양식에는 사용기기·브라우저 항목이 포함된다', () => {
        expect(BUG_TEMPLATE_CONTENT).toContain('사용기기');
        expect(BUG_TEMPLATE_CONTENT).toContain('브라우저');
    });
});

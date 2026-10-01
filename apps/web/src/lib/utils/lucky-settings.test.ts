import { describe, expect, it } from 'vitest';
import type { LuckySettings } from '$lib/api/board-extended-settings';
import { mergeLuckySettings } from './lucky-settings';

const form = { enabled: true, points: 10, odds: 3, comment_odds: 7 };

describe('mergeLuckySettings', () => {
    it('카드가 모르는 키를 보존한다', () => {
        const prev = { enabled: false, points: 1, odds: 2, foo: 'bar' } as LuckySettings & {
            foo: string;
        };
        const merged = mergeLuckySettings(prev, form) as LuckySettings & { foo?: string };
        expect(merged.foo).toBe('bar');
        expect(merged).toMatchObject(form);
    });

    it('comment_odds 를 폼 값으로 덮어쓴다', () => {
        const merged = mergeLuckySettings({ comment_odds: 99 }, { ...form, comment_odds: 0 });
        expect(merged.comment_odds).toBe(0);
    });

    it('prev 가 undefined 면 폼 값만 담는다', () => {
        expect(mergeLuckySettings(undefined, form)).toEqual(form);
    });

    it('원본 객체를 변경하지 않는다', () => {
        const prev: LuckySettings = { enabled: false, comment_odds: 5 };
        mergeLuckySettings(prev, form);
        expect(prev).toEqual({ enabled: false, comment_odds: 5 });
    });
});

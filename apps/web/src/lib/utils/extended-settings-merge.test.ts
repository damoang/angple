import { describe, expect, it } from 'vitest';
import type { ExtendedSettings } from '$lib/api/board-extended-settings';
import { mergeLuckySettings } from './lucky-settings';
import { mergeExtendedSettings } from './extended-settings-merge';

type Loose = Record<string, unknown>;

describe('mergeExtendedSettings', () => {
    it('폼이 모르는 write_notice.title 을 보존한다', () => {
        const prev: ExtendedSettings = {
            write_notice: { enabled: true, mode: 'blocking', title: '안내 제목', html: '<p>a</p>' }
        };
        const update: ExtendedSettings = {
            write_notice: { enabled: false, mode: 'banner', html: '<p>b</p>', skipHours: 0 }
        };
        const merged = mergeExtendedSettings(prev, update);
        expect(merged.write_notice?.title).toBe('안내 제목');
        expect(merged.write_notice).toMatchObject(update.write_notice!);
    });

    it('update 에 없는 최상위 intro 와 post_status 를 보존한다', () => {
        const prev = {
            intro: '게시판 소개',
            post_status: { enabled: true },
            xp: { write: 1, comment: 1 }
        } as ExtendedSettings & { intro: string };
        const update: ExtendedSettings = { xp: { write: 5, comment: 2 } };
        const merged = mergeExtendedSettings(prev, update) as Loose;
        expect(merged.intro).toBe('게시판 소개');
        expect(merged.post_status).toEqual({ enabled: true });
        expect(merged.xp).toEqual({ write: 5, comment: 2 });
    });

    it('섹션 안의 폼 값은 덮어쓴다', () => {
        const prev: ExtendedSettings = {
            writing: { memberOnly: true, maxPosts: 3 },
            promotion: { insertIndex: 4, insertCount: 2 }
        };
        const update: ExtendedSettings = {
            writing: { memberOnly: false, maxPosts: 0 },
            promotion: { insertIndex: null, insertCount: null }
        };
        const merged = mergeExtendedSettings(prev, update);
        expect(merged.writing).toEqual({ memberOnly: false, maxPosts: 0 });
        expect(merged.promotion).toEqual({ insertIndex: null, insertCount: null });
    });

    it('prev 가 undefined 이거나 {} 면 update 와 같다', () => {
        const update: ExtendedSettings = {
            xp: { write: 1, comment: 2 },
            post_status: { enabled: false }
        };
        expect(mergeExtendedSettings(undefined, update)).toEqual(update);
        expect(mergeExtendedSettings({}, update)).toEqual(update);
    });

    it('배열 섹션은 병합하지 않고 update 값으로 대체한다', () => {
        const prev = { tags: ['a', 'b', 'c'], meta: { x: 1 } } as Loose;
        const update = { tags: ['z'], meta: ['y'] } as Loose;
        const merged = mergeExtendedSettings(prev, update);
        expect(merged.tags).toEqual(['z']);
        expect(merged.meta).toEqual(['y']);
    });

    it('원시값 섹션은 update 값으로 대체한다', () => {
        const merged = mergeExtendedSettings({ intro: 'old' } as Loose, { intro: 'new' } as Loose);
        expect(merged.intro).toBe('new');
    });

    it('update 의 undefined 섹션은 원본을 지우지 않는다', () => {
        const prev: ExtendedSettings = { post_status: { enabled: true } };
        const merged = mergeExtendedSettings(prev, { post_status: undefined });
        expect(merged.post_status).toEqual({ enabled: true });
    });

    it('원본 객체를 변경하지 않는다', () => {
        const prev: ExtendedSettings = { xp: { write: 1, comment: 1 } };
        mergeExtendedSettings(prev, { xp: { write: 9, comment: 9 } });
        expect(prev).toEqual({ xp: { write: 1, comment: 1 } });
    });

    it('mergeLuckySettings 와 겹쳐 써도 lucky 결과가 같다', () => {
        const prevLucky = { enabled: false, points: 1, odds: 2, foo: 'bar' } as Loose;
        const prev = { lucky: prevLucky } as ExtendedSettings;
        const lucky = mergeLuckySettings(prev.lucky, {
            enabled: true,
            points: 10,
            odds: 3,
            comment_odds: 7
        });
        const merged = mergeExtendedSettings(prev, { lucky });
        expect(merged.lucky).toEqual(lucky);
    });
});

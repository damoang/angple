import { describe, expect, it } from 'vitest';
import {
    collapsedNoticeCount,
    isReadNoticeHidden,
    shouldShowCollapseButton,
    type NoticeCollapseState
} from './notice-collapse';

const s = (o: Partial<NoticeCollapseState> = {}): NoticeCollapseState => ({
    hideRead: false,
    collapseRead: true,
    expanded: false,
    ...o
});

describe('isReadNoticeHidden', () => {
    it('기본(접기 켬, 안 펼침) — 읽은 공지는 감춘다', () => {
        expect(isReadNoticeHidden(s())).toBe(true);
    });

    it('펼치면 보인다', () => {
        expect(isReadNoticeHidden(s({ expanded: true }))).toBe(false);
    });

    it('접기를 끄면 예전처럼 그대로 보인다 — 회귀 없음', () => {
        expect(isReadNoticeHidden(s({ collapseRead: false }))).toBe(false);
    });

    // ⛔ 이 테스트가 설정 존중의 방어선이다.
    it('숨기기가 접기·펼침보다 우선한다', () => {
        expect(isReadNoticeHidden(s({ hideRead: true }))).toBe(true);
        expect(isReadNoticeHidden(s({ hideRead: true, expanded: true }))).toBe(true);
        expect(isReadNoticeHidden(s({ hideRead: true, collapseRead: false }))).toBe(true);
    });
});

describe('collapsedNoticeCount', () => {
    it('접힌 상태에서는 읽은 개수를 그대로 알린다', () => {
        expect(collapsedNoticeCount(s(), 4)).toBe(4);
    });

    it('펼친 뒤에는 0 — 버튼이 사라진다', () => {
        expect(collapsedNoticeCount(s({ expanded: true }), 4)).toBe(0);
    });

    it('접기를 끄면 0', () => {
        expect(collapsedNoticeCount(s({ collapseRead: false }), 4)).toBe(0);
    });

    // ⛔ 눌러도 안 펼쳐지는 버튼을 보여주면 고장으로 오해된다.
    it('숨기기를 켠 분에게는 펼치기 버튼을 띄우지 않는다', () => {
        expect(collapsedNoticeCount(s({ hideRead: true }), 4)).toBe(0);
    });

    it('읽은 공지가 없으면 0', () => {
        expect(collapsedNoticeCount(s(), 0)).toBe(0);
    });
});

describe('shouldShowCollapseButton', () => {
    it('펼친 상태에서만 접기 버튼이 보인다', () => {
        expect(shouldShowCollapseButton(s({ expanded: true }), 3)).toBe(true);
        expect(shouldShowCollapseButton(s(), 3)).toBe(false);
    });

    it('접기를 껐으면 접기 버튼도 없다', () => {
        expect(shouldShowCollapseButton(s({ expanded: true, collapseRead: false }), 3)).toBe(false);
    });

    it('숨기기를 켰으면 접기 버튼도 없다', () => {
        expect(shouldShowCollapseButton(s({ expanded: true, hideRead: true }), 3)).toBe(false);
    });

    it('읽은 공지가 없으면 접기 버튼도 없다', () => {
        expect(shouldShowCollapseButton(s({ expanded: true }), 0)).toBe(false);
    });
});

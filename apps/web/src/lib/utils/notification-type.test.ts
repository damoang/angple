import { describe, expect, it } from 'vitest';
import {
    getNotificationColor,
    getNotificationEmoji,
    getNotificationLabel
} from './notification-type';

describe('getNotificationEmoji', () => {
    // ⛔ 제보(bug/13242)의 핵심. 이 넷이 서로 달라야 제보가 해결된다.
    it('댓글·답글·글 공감·댓글 공감이 모두 다른 표식을 가진다', () => {
        const marks = ['comment', 'reply', 'like', 'like_comment'].map(getNotificationEmoji);
        expect(new Set(marks).size).toBe(4);
        expect(marks.every((m) => m.length > 0)).toBe(true);
    });

    it('첫 글자가 대상(글/댓글)을 가리킨다', () => {
        // 글에 관한 일
        expect(getNotificationEmoji('comment').startsWith('📄')).toBe(true);
        expect(getNotificationEmoji('like').startsWith('📄')).toBe(true);
        expect(getNotificationEmoji('subscribe').startsWith('📄')).toBe(true);
        // 댓글에 관한 일
        expect(getNotificationEmoji('reply').startsWith('💬')).toBe(true);
        expect(getNotificationEmoji('like_comment').startsWith('💬')).toBe(true);
    });

    // ⛔ 색이 아니라 모양으로 갈려야 한다 — 흑백 폴백에서도 구분되도록.
    it('글 공감과 댓글 공감은 하트 색이 아니라 앞 글자로 갈린다', () => {
        expect(getNotificationEmoji('like')).not.toBe(getNotificationEmoji('like_comment'));
        expect(getNotificationEmoji('like')[0]).not.toBe(getNotificationEmoji('like_comment')[0]);
    });

    it('구독 새 글과 팔로우 새 글이 구분된다 — 예전엔 둘 다 회색 system 이었다', () => {
        expect(getNotificationEmoji('subscribe')).not.toBe(getNotificationEmoji('follow'));
    });

    // ⛔ 배포 순서(be/web)가 어긋나도 알림함이 깨지면 안 된다.
    it('모르는 타입은 조용히 폴백한다', () => {
        expect(getNotificationEmoji('what_is_this')).toBe('');
        expect(getNotificationColor('what_is_this')).toBe('text-muted-foreground');
        expect(getNotificationLabel('what_is_this')).toBe('알림');
    });

    it('통합 묶음은 표식을 붙이지 않는다 — 본문에 이미 개수가 있다', () => {
        expect(getNotificationEmoji('merged')).toBe('');
    });
});

describe('getNotificationLabel', () => {
    // 이모지는 스크린리더가 읽지 않거나 엉뚱하게 읽는다. 이름이 본문이다.
    it('구분이 필요한 종류마다 서로 다른 한글 이름을 가진다', () => {
        const labels = [
            'comment',
            'reply',
            'like',
            'like_comment',
            'mention',
            'memo',
            'subscribe',
            'follow'
        ].map(getNotificationLabel);
        expect(new Set(labels).size).toBe(8);
    });
});

describe('getNotificationColor', () => {
    it('구분이 필요한 종류는 색도 다르다', () => {
        expect(getNotificationColor('like')).not.toBe(getNotificationColor('like_comment'));
        expect(getNotificationColor('comment')).not.toBe(getNotificationColor('reply'));
        expect(getNotificationColor('subscribe')).not.toBe(getNotificationColor('follow'));
    });
});

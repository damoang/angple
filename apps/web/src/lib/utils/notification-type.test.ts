import { describe, expect, it } from 'vitest';
import {
    getNotificationColor,
    getNotificationEmoji,
    getNotificationLabel
} from './notification-type';

/**
 * 표식의 첫 '글자'(대상: 📄 글 / 💬 댓글).
 *
 * ⛔ `str[0]` 을 쓰면 안 된다. 이모지는 서로게이트 쌍이라 인덱싱이 반쪽만 준다.
 *    하필 📄(U+1F4C4)와 💬(U+1F4AC)는 상위 서로게이트가 둘 다 D83D 로 같아서,
 *    `[0]` 비교는 **서로 다른 이모지를 같다고 판정**한다(CI 에서 이걸로 한 번 터졌다).
 *    Array spread 는 코드포인트 단위로 쪼개므로 안전하다.
 */
const firstGlyph = (s: string): string => [...s][0] ?? '';

describe('getNotificationEmoji', () => {
    // ⛔ 제보(bug/13242)의 핵심. 이 넷이 서로 달라야 제보가 해결된다.
    it('댓글·답글·글 공감·댓글 공감이 모두 다른 표식을 가진다', () => {
        const marks = ['comment', 'reply', 'like', 'like_comment'].map(getNotificationEmoji);
        expect(new Set(marks).size).toBe(4);
        expect(marks.every((m) => m.length > 0)).toBe(true);
    });

    it('첫 글자가 대상(글/댓글)을 가리킨다', () => {
        // 글에 관한 일
        expect(firstGlyph(getNotificationEmoji('comment'))).toBe('📄');
        expect(firstGlyph(getNotificationEmoji('like'))).toBe('📄');
        expect(firstGlyph(getNotificationEmoji('subscribe'))).toBe('📄');
        // 댓글에 관한 일
        expect(firstGlyph(getNotificationEmoji('reply'))).toBe('💬');
        expect(firstGlyph(getNotificationEmoji('like_comment'))).toBe('💬');
    });

    // ⛔ 색이 아니라 모양으로 갈려야 한다 — 흑백 폴백에서도 구분되도록.
    it('글 공감과 댓글 공감은 하트 색이 아니라 앞 글자로 갈린다', () => {
        expect(getNotificationEmoji('like')).not.toBe(getNotificationEmoji('like_comment'));
        expect(firstGlyph(getNotificationEmoji('like'))).not.toBe(
            firstGlyph(getNotificationEmoji('like_comment'))
        );
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

    // ⛔ bug/13332 의 재발 방지선.
    //    묶음 알림에 표식이 없으면 「알림 묶어 보기」(기본 켬) 사용자에게는 사실상 모든
    //    알림이 같은 회색 느낌표가 된다. 제보자가 "댓글과 답글 구분이 어렵다"고 한 상태다.
    it('섞인 묶음도 표식을 가지며 대상(글/댓글)이 구분된다', () => {
        expect(getNotificationEmoji('merged_post')).not.toBe('');
        expect(getNotificationEmoji('merged_comment')).not.toBe('');
        expect(getNotificationEmoji('merged_post')).not.toBe(
            getNotificationEmoji('merged_comment')
        );
        expect(firstGlyph(getNotificationEmoji('merged_post'))).toBe('📄');
        expect(firstGlyph(getNotificationEmoji('merged_comment'))).toBe('💬');
    });

    // be 배포가 web 보다 늦어도 화면이 회색으로 죽지 않아야 한다.
    it('옛 merged 값도 표식을 가진다', () => {
        expect(getNotificationEmoji('merged')).not.toBe('');
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

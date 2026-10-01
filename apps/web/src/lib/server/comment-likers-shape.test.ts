import { describe, expect, it } from 'vitest';
import { groupCommentLikers, maskIp, toSafeIso, type LikerRow } from './comment-likers-shape';

const liker = (wr_id: number, mb_id: string): LikerRow => ({
    wr_id,
    mb_id,
    mb_nick: `닉_${mb_id}`,
    mb_image_url: '',
    mb_image_updated_at: null,
    bg_ip: '203.0.113.7',
    bg_datetime: '2026-10-01 12:34:56'
});

describe('maskIp', () => {
    it('IPv4 는 둘째 자리를 가린다', () => {
        expect(maskIp('203.0.113.7')).toBe('203.♡.113.7');
    });

    it('IPv4 가 아니면 앞 세 글자만 남긴다', () => {
        expect(maskIp('2001:db8::1')).toBe('200.♡');
    });

    it('비어 있으면 빈 문자열', () => {
        expect(maskIp('')).toBe('');
        expect(maskIp(null)).toBe('');
        expect(maskIp(undefined)).toBe('');
    });
});

describe('toSafeIso', () => {
    it('DB 시각을 ISO 형식으로 바꾼다', () => {
        expect(toSafeIso('2026-10-01 12:34:56')).toBe('2026-10-01T12:34:56Z');
    });

    it('비어 있거나 0000 으로 시작하면 빈 문자열', () => {
        expect(toSafeIso('')).toBe('');
        expect(toSafeIso(null)).toBe('');
        expect(toSafeIso('0000-00-00 00:00:00')).toBe('');
    });
});

describe('groupCommentLikers', () => {
    it('요청한 댓글은 추천자가 없어도 빈 항목으로 들어간다', () => {
        expect(groupCommentLikers([1, 2], [], [], true)).toEqual({
            '1': { likers: [], total: 0 },
            '2': { likers: [], total: 0 }
        });
    });

    it('댓글별로 추천자와 수를 묶는다', () => {
        const out = groupCommentLikers(
            [1, 2],
            [
                { wr_id: 1, total: 7 },
                { wr_id: 2, total: 1 }
            ],
            [liker(1, 'a'), liker(1, 'b'), liker(2, 'c')],
            true
        );
        expect(out['1'].total).toBe(7);
        expect(out['1'].likers.map((l) => l.mb_id)).toEqual(['a', 'b']);
        expect(out['2'].likers.map((l) => l.mb_id)).toEqual(['c']);
        expect(out['1'].likers[0]).toEqual({
            mb_id: 'a',
            mb_nick: '닉_a',
            mb_image: '',
            mb_image_updated_at: undefined,
            bg_ip: '203.♡.113.7',
            liked_at: '2026-10-01T12:34:56Z'
        });
    });

    it('비로그인 요청에는 IP 를 싣지 않는다', () => {
        const out = groupCommentLikers([1], [{ wr_id: 1, total: 1 }], [liker(1, 'a')], false);
        expect(out['1'].likers[0].bg_ip).toBe('');
    });

    it('요청하지 않은 댓글의 행은 버린다', () => {
        const out = groupCommentLikers([1], [{ wr_id: 9, total: 3 }], [liker(9, 'z')], true);
        expect(out).toEqual({ '1': { likers: [], total: 0 } });
    });
});

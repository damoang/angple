import { describe, it, expect } from 'vitest';
import { parseUserBasicCookie } from './user-basic';

describe('parseUserBasicCookie', () => {
    const validUser = {
        id: 'abc',
        nickname: '닉네임',
        mb_level: 3,
        as_level: 15,
        mb_image: 'data/member_image/ab/abc.webp',
        mb_image_updated_at: 1760156943
    };

    function encode(obj: unknown) {
        return Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64');
    }

    it('valid cookie → 파싱 성공', () => {
        expect(parseUserBasicCookie(encode(validUser))).toEqual(validUser);
    });

    it('null/undefined/empty → null', () => {
        expect(parseUserBasicCookie(null)).toBeNull();
        expect(parseUserBasicCookie(undefined)).toBeNull();
        expect(parseUserBasicCookie('')).toBeNull();
    });

    it('invalid base64 → null', () => {
        expect(parseUserBasicCookie('not-base64-!@#')).toBeNull();
    });

    it('valid base64, invalid JSON → null', () => {
        expect(parseUserBasicCookie(Buffer.from('not json').toString('base64'))).toBeNull();
    });

    it('id 누락 → null', () => {
        const { id: _id, ...rest } = validUser;
        expect(parseUserBasicCookie(encode(rest))).toBeNull();
    });

    it('mb_level 숫자 아님 → null', () => {
        expect(parseUserBasicCookie(encode({ ...validUser, mb_level: '3' }))).toBeNull();
    });

    it('optional 필드 누락 — null로 채움', () => {
        const { mb_image: _i, mb_image_updated_at: _t, ...rest } = validUser;
        const result = parseUserBasicCookie(encode(rest));
        expect(result?.mb_image).toBeNull();
        expect(result?.mb_image_updated_at).toBeNull();
    });
});

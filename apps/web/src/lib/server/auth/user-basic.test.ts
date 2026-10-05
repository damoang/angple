import { describe, it, expect } from 'vitest';
import {
    buildUserBasicFromMember,
    parseUserBasicCookie,
    toImageUnixSeconds,
    userBasicNeedsReissue,
    type UserBasic
} from './user-basic';

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

    it('mb_no 포함 쿠키 → 숫자로 파싱 (결제 user_id 용)', () => {
        const result = parseUserBasicCookie(encode({ ...validUser, mb_no: 12345 }));
        expect(result?.mb_no).toBe(12345);
    });

    it('mb_no 없는 구쿠키 → mb_no undefined (하위호환, 파싱은 성공)', () => {
        const result = parseUserBasicCookie(encode(validUser));
        expect(result).not.toBeNull();
        expect(result?.mb_no).toBeUndefined();
    });

    it('mb_no 숫자 아님 → undefined (거부하지 않음)', () => {
        const result = parseUserBasicCookie(encode({ ...validUser, mb_no: '12345' }));
        expect(result).not.toBeNull();
        expect(result?.mb_no).toBeUndefined();
    });
});

describe('toImageUnixSeconds', () => {
    it('ISO 문자열 → Unix 초', () => {
        expect(toImageUnixSeconds('2026-10-06T11:42:16.000Z')).toBe(1791286936);
    });

    it('Date 객체도 받는다', () => {
        expect(toImageUnixSeconds(new Date('2026-10-06T11:42:16.000Z'))).toBe(1791286936);
    });

    it('비었거나 해석 불가 → null', () => {
        expect(toImageUnixSeconds(null)).toBeNull();
        expect(toImageUnixSeconds(undefined)).toBeNull();
        expect(toImageUnixSeconds('')).toBeNull();
        expect(toImageUnixSeconds('0000-00-00 00:00:00')).toBeNull();
    });
});

describe('buildUserBasicFromMember', () => {
    const member = {
        mb_id: 'abc',
        mb_no: 7,
        mb_nick: '닉네임',
        mb_name: '이름',
        mb_level: 3,
        as_level: 15,
        mb_certify: 'simple',
        mb_image_url: 'data/member_image/ab/abc_1.webp',
        mb_image_updated_at: '2026-10-06T11:42:16.000Z'
    };

    it('hooks 와 같은 필드 집합(certified 포함)을 만든다', () => {
        expect(buildUserBasicFromMember(member)).toEqual({
            id: 'abc',
            mb_no: 7,
            nickname: '닉네임',
            mb_level: 3,
            as_level: 15,
            mb_image: 'data/member_image/ab/abc_1.webp',
            mb_image_updated_at: 1791286936,
            certified: true
        });
    });

    it('미인증·이미지 없음·닉네임 없음', () => {
        const basic = buildUserBasicFromMember({
            ...member,
            mb_nick: '',
            mb_certify: '',
            mb_image_url: '',
            mb_image_updated_at: null
        });
        expect(basic.nickname).toBe('이름');
        expect(basic.certified).toBe(false);
        expect(basic.mb_image).toBeNull();
        expect(basic.mb_image_updated_at).toBeNull();
    });

    it('레벨이 비면 0', () => {
        const basic = buildUserBasicFromMember({ ...member, mb_level: null, as_level: null });
        expect(basic.mb_level).toBe(0);
        expect(basic.as_level).toBe(0);
    });
});

describe('userBasicNeedsReissue', () => {
    const next: UserBasic = {
        id: 'abc',
        mb_no: 7,
        nickname: '닉네임',
        mb_level: 3,
        as_level: 15,
        mb_image: 'data/member_image/ab/abc_1.webp',
        mb_image_updated_at: 1791286936,
        certified: true
    };

    function roundTrip(basic: UserBasic): UserBasic | null {
        return parseUserBasicCookie(Buffer.from(JSON.stringify(basic), 'utf-8').toString('base64'));
    }

    it('쿠키 없음 → 재발급', () => {
        expect(userBasicNeedsReissue(null, next)).toBe(true);
    });

    it('같은 값으로 발급한 쿠키 → 재발급 안 함', () => {
        expect(userBasicNeedsReissue(roundTrip(next), next)).toBe(false);
    });

    it('certified 가 빠진 쿠키(이전 이미지 프록시 발급분) → 재발급', () => {
        const { certified: _c, ...legacy } = next;
        expect(userBasicNeedsReissue(roundTrip(legacy as UserBasic), next)).toBe(true);
    });

    it('필드 하나라도 다르면 재발급', () => {
        expect(userBasicNeedsReissue({ ...next, id: 'other' }, next)).toBe(true);
        expect(userBasicNeedsReissue({ ...next, mb_image_updated_at: 1 }, next)).toBe(true);
        expect(userBasicNeedsReissue({ ...next, certified: false }, next)).toBe(true);
        expect(userBasicNeedsReissue({ ...next, mb_level: 2 }, next)).toBe(true);
        expect(userBasicNeedsReissue({ ...next, as_level: 14 }, next)).toBe(true);
        expect(userBasicNeedsReissue({ ...next, nickname: '새닉' }, next)).toBe(true);
    });

    it('이미지 프록시와 hooks 가 같은 회원으로 만든 값은 서로 재발급을 부르지 않는다', () => {
        const member = {
            mb_id: 'abc',
            mb_no: 7,
            mb_nick: '닉네임',
            mb_name: '이름',
            mb_level: 3,
            as_level: 15,
            mb_certify: 'Y',
            mb_image_url: 'data/member_image/ab/abc_1.webp',
            mb_image_updated_at: '2026-10-06T11:42:16.000Z'
        };
        const issued = roundTrip(buildUserBasicFromMember(member));
        expect(userBasicNeedsReissue(issued, buildUserBasicFromMember(member))).toBe(false);
    });
});

import { describe, it, expect } from 'vitest';
import {
    AVATAR_PIN_TTL_MS,
    createAvatarPin,
    resolveSsrAvatar,
    toMemberImageKey
} from './avatar-pin';

describe('toMemberImageKey', () => {
    it('업로드 응답 URL → DB 키 형태', () => {
        expect(toMemberImageKey('https://cdn.example.net/data/member_image/ab/abc_1.webp')).toBe(
            'data/member_image/ab/abc_1.webp'
        );
    });

    it('쿼리·해시는 버린다', () => {
        expect(toMemberImageKey('https://cdn.example.net/data/member_image/ab/x.webp?v=1#a')).toBe(
            'data/member_image/ab/x.webp'
        );
        expect(toMemberImageKey('data/member_image/ab/x.webp?v=1')).toBe(
            'data/member_image/ab/x.webp'
        );
    });

    it('프로토콜 생략 URL·앞 슬래시도 처리', () => {
        expect(toMemberImageKey('//cdn.example.net/data/member_image/ab/x.webp')).toBe(
            'data/member_image/ab/x.webp'
        );
        expect(toMemberImageKey('/data/member_image/ab/x.webp')).toBe(
            'data/member_image/ab/x.webp'
        );
    });

    it('이미 키 형태면 그대로', () => {
        expect(toMemberImageKey('data/member_image/ab/x.webp')).toBe('data/member_image/ab/x.webp');
    });

    it('비었으면 null', () => {
        expect(toMemberImageKey(null)).toBeNull();
        expect(toMemberImageKey(undefined)).toBeNull();
        expect(toMemberImageKey('')).toBeNull();
        expect(toMemberImageKey('   ')).toBeNull();
        expect(toMemberImageKey('https://cdn.example.net')).toBeNull();
        expect(toMemberImageKey('https://cdn.example.net/')).toBeNull();
    });
});

describe('createAvatarPin', () => {
    it('기본 유지 시간은 회원 캐시 L1(60초)보다 길다', () => {
        expect(AVATAR_PIN_TTL_MS).toBeGreaterThan(60_000);
        expect(createAvatarPin(1000)).toEqual({ until: 1000 + AVATAR_PIN_TTL_MS });
    });

    it('유지 시간을 지정할 수 있다', () => {
        expect(createAvatarPin(1000, 5000)).toEqual({ until: 6000 });
    });
});

describe('resolveSsrAvatar', () => {
    const NEW = 'data/member_image/ab/abc_2.webp';
    const OLD = 'data/member_image/ab/abc_1.webp';

    it('고정 중이면 SSR 의 옛 사진으로 덮지 않는다', () => {
        const pin = createAvatarPin(0, 90_000);
        expect(resolveSsrAvatar({ current: NEW, ssr: OLD, pin, now: 30_000 })).toEqual({
            apply: false,
            keepPin: true
        });
    });

    it('고정 중이면 삭제한 사진을 SSR 이 되살리지 못한다', () => {
        const pin = createAvatarPin(0, 90_000);
        expect(resolveSsrAvatar({ current: undefined, ssr: OLD, pin, now: 30_000 })).toEqual({
            apply: false,
            keepPin: true
        });
    });

    it('고정 중엔 SSR 이 새 값과 같아도 고정 유지(다른 파드는 옛 값일 수 있다)', () => {
        const pin = createAvatarPin(0, 90_000);
        expect(resolveSsrAvatar({ current: NEW, ssr: NEW, pin, now: 30_000 })).toEqual({
            apply: false,
            keepPin: true
        });
    });

    it('고정이 만료되면 지우고 기존 규칙으로 SSR 값을 반영', () => {
        const pin = createAvatarPin(0, 90_000);
        expect(resolveSsrAvatar({ current: NEW, ssr: OLD, pin, now: 90_000 })).toEqual({
            apply: true,
            keepPin: false
        });
    });

    it('고정 없음: SSR 값이 다르면 반영', () => {
        expect(resolveSsrAvatar({ current: OLD, ssr: NEW, pin: null, now: 0 })).toEqual({
            apply: true,
            keepPin: false
        });
    });

    it('고정 없음: 같으면 반영하지 않는다', () => {
        expect(resolveSsrAvatar({ current: NEW, ssr: NEW, pin: null, now: 0 })).toEqual({
            apply: false,
            keepPin: false
        });
    });

    it('고정 없음: SSR 값이 비면 반영하지 않는다(기존 동작)', () => {
        expect(resolveSsrAvatar({ current: NEW, ssr: undefined, pin: null, now: 0 })).toEqual({
            apply: false,
            keepPin: false
        });
        expect(resolveSsrAvatar({ current: NEW, ssr: '', pin: null, now: 0 })).toEqual({
            apply: false,
            keepPin: false
        });
    });
});

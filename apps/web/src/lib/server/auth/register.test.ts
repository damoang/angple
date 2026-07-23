import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import { adler32, appendMbIdSuffix, generateSocialMbId, MB_ID_MAX_LENGTH } from './register';

describe('generateSocialMbId', () => {
    it('keeps the provider prefix and never emits a negative hash marker', () => {
        expect(generateSocialMbId('google', '108692925130582663034')).toMatch(
            /^google_[0-9a-f]{8}$/
        );
        expect(generateSocialMbId('naver', 'XUj7e3kQ0mJ4sYw2P9')).toMatch(/^naver_[0-9a-f]{8}$/);
    });

    it('normalizes signed adler32 outputs to unsigned hex', () => {
        const identifier = 'case-0';
        const md5Hash = createHash('md5').update(identifier).digest('hex');
        const signedValue = adler32(Buffer.from(md5Hash, 'utf-8'));

        expect(signedValue).toBeLessThan(0);
        expect(generateSocialMbId('google', identifier)).toBe(
            `google_${(signedValue >>> 0).toString(16).padStart(8, '0')}`
        );
    });
});

/**
 * mb_id 길이 회귀 방지.
 *
 * g5_member.mb_id는 varchar(20)인데 g5_member_social_profiles.mb_id는 varchar(255)다.
 * 접미사가 20자를 넘기면 회원 테이블에만 절단 저장되어 두 테이블의 mb_id가 어긋나고,
 * findSocialProfile이 존재하지 않는 회원을 가리켜 그 계정은 소셜 로그인이 영구 불가해진다.
 * (2026-07-23 실측: 그렇게 갇힌 계정 62건, 최근 두 달에만 46건)
 */
describe('appendMbIdSuffix', () => {
    const providers = ['google', 'naver', 'kakao', 'apple', 'facebook', 'twitter', 'payco'];

    it('어떤 provider의 base에 붙여도 mb_id 최대 길이를 넘지 않는다', () => {
        for (const provider of providers) {
            const base = generateSocialMbId(provider, `identifier-${provider}`);
            expect(appendMbIdSuffix(base).length).toBeLessThanOrEqual(MB_ID_MAX_LENGTH);
        }
    });

    it('base가 이미 최대 길이를 넘겨도 결과는 넘지 않는다', () => {
        const overlong = 'a'.repeat(MB_ID_MAX_LENGTH + 10);
        expect(appendMbIdSuffix(overlong).length).toBeLessThanOrEqual(MB_ID_MAX_LENGTH);
    });

    it('base 뒤에 밑줄과 16진수 접미사를 붙인다', () => {
        const base = generateSocialMbId('google', 'someone');
        const result = appendMbIdSuffix(base);

        expect(result.startsWith(`${base}_`)).toBe(true);
        expect(result.slice(base.length + 1)).toMatch(/^[0-9a-f]+$/);
    });

    it('반복 호출하면 서로 다른 값이 나온다(충돌 회피 목적)', () => {
        const base = generateSocialMbId('naver', 'someone');
        const results = new Set(Array.from({ length: 20 }, () => appendMbIdSuffix(base)));

        expect(results.size).toBeGreaterThan(1);
    });

    it('base 자체도 mb_id 최대 길이를 넘지 않는다', () => {
        for (const provider of providers) {
            expect(generateSocialMbId(provider, 'x').length).toBeLessThanOrEqual(MB_ID_MAX_LENGTH);
        }
    });
});

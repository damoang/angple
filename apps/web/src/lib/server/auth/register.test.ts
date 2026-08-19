import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import {
    adler32,
    appendMbIdSuffix,
    generateSocialMbId,
    MB_ID_MAX_LENGTH,
    stripInvisibleChars
} from './register';

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

/**
 * 복붙 닉네임 위생 회귀 방지.
 *
 * 외부 사이트에서 복사한 순수 한자 닉("山寂")이 앞뒤에 딸려온 안 보이는 문자
 * (전각공백·제로폭·BOM·제어문자) 때문에 허용 문자 정규식을 통과하지 못해 거부됐다.
 * (2026-08-19 실측: free/7070278 제보)
 * stripInvisibleChars가 그 문자만 걷어내고 일반 공백(U+0020) 정책은 유지해야 한다.
 *
 * 코드포인트를 String.fromCharCode 로 만들어 테스트 소스에도 안 보이는 문자를 직접 넣지 않는다.
 */
describe('stripInvisibleChars', () => {
    const ZWSP = String.fromCharCode(0x200b);
    const ZWNJ = String.fromCharCode(0x200c);
    const ZWJ = String.fromCharCode(0x200d);
    const WJ = String.fromCharCode(0x2060);
    const BOM = String.fromCharCode(0xfeff);
    const FWSP = String.fromCharCode(0x3000); // 전각공백 — 눈에 보이지 않는 공백
    const NUL = String.fromCharCode(0x0000); // C0 제어문자
    const NEL = String.fromCharCode(0x0085); // C1 제어문자

    it('전각공백을 제거해 복붙 한자 닉이 통과하도록 한다', () => {
        expect(stripInvisibleChars(`山${FWSP}寂`)).toBe('山寂');
    });

    it('제로폭/BOM/WJ/제어문자를 모두 제거한다', () => {
        expect(stripInvisibleChars(`${BOM}山${ZWSP}${ZWNJ}${ZWJ}${WJ}寂${NUL}${NEL}`)).toBe('山寂');
    });

    it('일반 공백(U+0020)은 제거하지 않는다 — 기존 정책 유지', () => {
        expect(stripInvisibleChars('a b')).toBe('a b');
    });

    it('안 보이는 문자가 없는 정상 닉은 그대로 둔다', () => {
        expect(stripInvisibleChars('홍길동')).toBe('홍길동');
        expect(stripInvisibleChars('山寂')).toBe('山寂');
        expect(stripInvisibleChars('a.b_c™')).toBe('a.b_c™');
    });
});

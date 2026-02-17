import { describe, it, expect } from 'vitest';
import { generateLicenseKey, isValidKeyFormat, signLicense, verifySignature } from './license';

describe('generateLicenseKey', () => {
    it('ANGP-XXXX-XXXX-XXXX-XXXX 형식과 일치', () => {
        const key = generateLicenseKey();
        expect(key).toMatch(/^ANGP-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('호출할 때마다 고유한 키 생성', () => {
        const keys = new Set<string>();
        for (let i = 0; i < 50; i++) {
            keys.add(generateLicenseKey());
        }
        expect(keys.size).toBe(50);
    });
});

describe('isValidKeyFormat', () => {
    it('유효한 키 통과', () => {
        expect(isValidKeyFormat('ANGP-ABCD-1234-EF56-7890')).toBe(true);
    });

    it('실제 생성된 키 통과', () => {
        const key = generateLicenseKey();
        expect(isValidKeyFormat(key)).toBe(true);
    });

    it('잘못된 접두사 실패', () => {
        expect(isValidKeyFormat('XXXX-ABCD-1234-EF56-7890')).toBe(false);
    });

    it('소문자 실패', () => {
        expect(isValidKeyFormat('ANGP-abcd-1234-ef56-7890')).toBe(false);
    });

    it('길이가 다르면 실패', () => {
        expect(isValidKeyFormat('ANGP-ABC-1234-EF56-7890')).toBe(false);
        expect(isValidKeyFormat('ANGP-ABCDE-1234-EF56-7890')).toBe(false);
    });

    it('대시가 없으면 실패', () => {
        expect(isValidKeyFormat('ANGPABCD1234EF567890')).toBe(false);
    });

    it('빈 문자열 실패', () => {
        expect(isValidKeyFormat('')).toBe(false);
    });
});

describe('signLicense', () => {
    it('동일 입력에 대해 결정적 출력', () => {
        const sig1 = signLicense('ANGP-AAAA-BBBB-CCCC-DDDD', 'product1', 'example.com');
        const sig2 = signLicense('ANGP-AAAA-BBBB-CCCC-DDDD', 'product1', 'example.com');

        expect(sig1).toBe(sig2);
    });

    it('입력이 다르면 서명이 달라짐', () => {
        const sig1 = signLicense('ANGP-AAAA-BBBB-CCCC-DDDD', 'product1', 'example.com');
        const sig2 = signLicense('ANGP-AAAA-BBBB-CCCC-DDDD', 'product2', 'example.com');
        const sig3 = signLicense('ANGP-AAAA-BBBB-CCCC-DDDD', 'product1', 'other.com');

        expect(sig1).not.toBe(sig2);
        expect(sig1).not.toBe(sig3);
    });

    it('hex 문자열 반환', () => {
        const sig = signLicense('ANGP-AAAA-BBBB-CCCC-DDDD', 'product1', 'example.com');
        expect(sig).toMatch(/^[a-f0-9]+$/);
    });
});

describe('verifySignature', () => {
    it('유효한 서명 검증 통과', () => {
        const key = 'ANGP-AAAA-BBBB-CCCC-DDDD';
        const productId = 'premium';
        const domain = 'mysite.com';
        const signature = signLicense(key, productId, domain);

        expect(verifySignature(key, productId, domain, signature)).toBe(true);
    });

    it('변조된 서명 검증 실패', () => {
        const key = 'ANGP-AAAA-BBBB-CCCC-DDDD';
        const productId = 'premium';
        const domain = 'mysite.com';

        expect(verifySignature(key, productId, domain, 'tampered-signature')).toBe(false);
    });

    it('다른 도메인으로 검증 실패', () => {
        const key = 'ANGP-AAAA-BBBB-CCCC-DDDD';
        const productId = 'premium';
        const signature = signLicense(key, productId, 'original.com');

        expect(verifySignature(key, productId, 'different.com', signature)).toBe(false);
    });
});

/**
 * 라이선스 키 생성 및 검증 유틸리티 (서버 사이드)
 */

import { randomBytes, createHmac } from 'node:crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'angple-license-secret';

/**
 * 라이선스 키 생성
 * 형식: ANGP-XXXX-XXXX-XXXX-XXXX (20자, 4자리 × 4 그룹)
 */
export function generateLicenseKey(): string {
    const bytes = randomBytes(16);
    const hex = bytes.toString('hex').toUpperCase();
    const parts = [
        hex.slice(0, 4),
        hex.slice(4, 8),
        hex.slice(8, 12),
        hex.slice(12, 16)
    ];
    return `ANGP-${parts.join('-')}`;
}

/**
 * 라이선스 키 형식 검증
 */
export function isValidKeyFormat(key: string): boolean {
    return /^ANGP-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key);
}

/**
 * 라이선스 서명 생성 (변조 방지)
 */
export function signLicense(key: string, productId: string, domain: string): string {
    return createHmac('sha256', LICENSE_SECRET)
        .update(`${key}:${productId}:${domain}`)
        .digest('hex');
}

/**
 * 라이선스 서명 검증
 */
export function verifySignature(
    key: string,
    productId: string,
    domain: string,
    signature: string
): boolean {
    const expected = signLicense(key, productId, domain);
    return expected === signature;
}

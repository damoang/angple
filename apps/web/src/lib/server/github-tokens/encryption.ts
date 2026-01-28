/**
 * AES-256-GCM 암호화 유틸리티
 *
 * GitHub Personal Access Token을 안전하게 암호화/복호화합니다.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 암호화 키 가져오기
 * @returns 32바이트 hex 키
 */
function getEncryptionKey(): string {
    const key = env.GITHUB_TOKEN_ENCRYPTION_KEY;

    if (!key) {
        throw new Error(
            'GITHUB_TOKEN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. ' +
                "다음 명령어로 키를 생성하세요: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }

    // 64자 hex 문자열 검증 (32바이트)
    if (!/^[a-fA-F0-9]{64}$/.test(key)) {
        throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY는 64자 hex 문자열이어야 합니다.');
    }

    return key;
}

/**
 * 문자열 암호화
 *
 * @param text - 암호화할 평문
 * @returns iv:authTag:encrypted 형식의 암호문
 */
export function encrypt(text: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // iv:authTag:encrypted 형식으로 반환
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 암호문 복호화
 *
 * @param encrypted - iv:authTag:encrypted 형식의 암호문
 * @returns 복호화된 평문
 */
export function decrypt(encrypted: string): string {
    const key = getEncryptionKey();
    const parts = encrypted.split(':');

    if (parts.length !== 3) {
        throw new Error('잘못된 암호문 형식입니다.');
    }

    const [ivHex, authTagHex, encryptedText] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH) {
        throw new Error('잘못된 IV 길이입니다.');
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('잘못된 인증 태그 길이입니다.');
    }

    // authTag 길이는 위에서 이미 검증됨 (AUTH_TAG_LENGTH = 16)
    // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * 암호화 키가 설정되어 있는지 확인
 */
export function isEncryptionConfigured(): boolean {
    try {
        getEncryptionKey();
        return true;
    } catch {
        return false;
    }
}

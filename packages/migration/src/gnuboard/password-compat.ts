/**
 * PHP password_hash() 호환 레이어
 *
 * 그누보드는 PHP의 password_hash(PASSWORD_BCRYPT)를 사용합니다.
 * Node.js에서도 bcrypt로 검증할 수 있어 비밀번호를 그대로 마이그레이션합니다.
 *
 * 그누보드5 비밀번호 형식:
 * - 최신: $2y$... (PHP bcrypt)
 * - 구버전: md5(password) → SHA-256 기반 커스텀 해시
 *
 * Angple은 Go 백엔드에서 bcrypt.CompareHashAndPassword()를 사용하므로
 * $2y$ → $2a$ 변환만 필요합니다 (PHP 호환 플래그 차이).
 */

/**
 * PHP bcrypt 해시를 Go/Node.js 호환 형식으로 변환
 *
 * PHP의 password_hash()는 $2y$ 접두사를 사용하지만
 * Go의 golang.org/x/crypto/bcrypt와 Node.js의 bcryptjs는
 * $2a$ 또는 $2b$를 기대합니다.
 *
 * $2y$와 $2a$는 기능적으로 동일하므로 접두사만 교체합니다.
 */
export function convertPhpBcryptHash(phpHash: string): string {
    if (phpHash.startsWith('$2y$')) {
        return '$2a$' + phpHash.slice(4);
    }
    // 이미 $2a$ 또는 $2b$ 형식이면 그대로
    if (phpHash.startsWith('$2a$') || phpHash.startsWith('$2b$')) {
        return phpHash;
    }
    // bcrypt가 아닌 경우 (md5 등 구버전) — 그대로 반환하되 플래그 표시
    return phpHash;
}

/**
 * 비밀번호 해시 타입 감지
 */
export function detectHashType(hash: string): 'bcrypt' | 'md5' | 'sha256' | 'unknown' {
    if (hash.startsWith('$2y$') || hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
        return 'bcrypt';
    }
    if (/^[a-f0-9]{32}$/i.test(hash)) {
        return 'md5';
    }
    if (/^[a-f0-9]{64}$/i.test(hash)) {
        return 'sha256';
    }
    return 'unknown';
}

/**
 * 비밀번호 마이그레이션 전략
 *
 * - bcrypt ($2y$): $2a$ 변환 → 바로 로그인 가능
 * - md5/sha256 (구버전): 비밀번호 초기화 필요 → 사용자에게 재설정 이메일 발송
 */
export function migratePassword(phpHash: string): {
    hash: string;
    needsReset: boolean;
    hashType: string;
} {
    const hashType = detectHashType(phpHash);

    if (hashType === 'bcrypt') {
        return {
            hash: convertPhpBcryptHash(phpHash),
            needsReset: false,
            hashType
        };
    }

    // 구버전 해시 — 원본 보존하되 재설정 필요 플래그
    return {
        hash: phpHash,
        needsReset: true,
        hashType
    };
}

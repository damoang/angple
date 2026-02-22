/**
 * JWT 생성/검증
 * Go 백엔드와 동일한 JWT_SECRET + HS256 사용 → 호환성 유지
 *
 * Refresh Token 로테이션:
 * - 발급 시 SHA-256 해시를 DB에 저장 (token-store.ts)
 * - 갱신 시 기존 토큰 폐기 + 새 토큰 발급
 * - 재사용 탐지 시 패밀리 전체 폐기
 */
import { SignJWT, jwtVerify } from 'jose';
import {
    hashToken,
    generateFamilyId,
    storeRefreshToken,
    findValidToken,
    revokeToken
} from './token-store.js';

const JWT_SECRET = process.env.JWT_SECRET || '';
const DAMOANG_JWT_SECRET = process.env.DAMOANG_JWT_SECRET || '';

const secret = new TextEncoder().encode(JWT_SECRET);
const damoangSecret = new TextEncoder().encode(DAMOANG_JWT_SECRET);

/** Refresh token 만료 시간 (7일, 밀리초) */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
    sub: string; // mb_id
    nickname: string;
    level: number;
    email: string;
}

/** Access Token 생성 (15분) — 내부 전용 (브라우저 노출 없음) */
export async function generateAccessToken(user: {
    mb_id: string;
    mb_nick: string;
    mb_level: number;
    mb_email: string;
}): Promise<string> {
    return new SignJWT({
        sub: user.mb_id,
        nickname: user.mb_nick,
        level: user.mb_level,
        email: user.mb_email
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('angple')
        .sign(secret);
}

/** Refresh Token 생성 (7일) + DB 저장 */
export async function generateRefreshToken(
    mbId: string,
    metadata?: { ip?: string; userAgent?: string; familyId?: string }
): Promise<{ token: string; familyId: string }> {
    const familyId = metadata?.familyId || generateFamilyId();

    const token = await new SignJWT({ sub: mbId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .setIssuer('angple')
        .sign(secret);

    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await storeRefreshToken(tokenHash, mbId, familyId, expiresAt, metadata);

    return { token, familyId };
}

/**
 * Refresh Token 로테이션
 * 기존 토큰을 폐기하고 새 토큰 발급 (동일 familyId 유지)
 * @returns 새 토큰 또는 null (유효하지 않은 토큰)
 */
export async function rotateRefreshToken(
    oldToken: string,
    metadata?: { ip?: string; userAgent?: string }
): Promise<{ token: string; mbId: string } | null> {
    // 1. JWT 서명 검증
    const payload = await verifyToken(oldToken);
    if (!payload?.sub) return null;

    // 2. DB에서 유효성 확인 (폐기/만료 체크)
    const oldTokenHash = hashToken(oldToken);
    const tokenInfo = await findValidToken(oldTokenHash);
    if (!tokenInfo) return null;

    // 3. 기존 토큰 폐기
    await revokeToken(oldTokenHash);

    // 4. 새 토큰 발급 (동일 familyId)
    const { token } = await generateRefreshToken(tokenInfo.mbId, {
        ...metadata,
        familyId: tokenInfo.familyId
    });

    return { token, mbId: tokenInfo.mbId };
}

/** JWT 검증 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret, { issuer: 'angple' });
        return {
            sub: payload.sub as string,
            nickname: (payload.nickname as string) || '',
            level: (payload.level as number) || 0,
            email: (payload.email as string) || ''
        };
    } catch {
        return null;
    }
}

/**
 * JWT 검증 (레거시 PHP damoang_jwt 쿠키용)
 * PHP SimpleJWT가 생성한 토큰: DAMOANG_JWT_SECRET 사용, payload에 mb_id 필드
 */
export async function verifyTokenLax(token: string): Promise<JwtPayload | null> {
    try {
        const { payload } = await jwtVerify(token, damoangSecret);
        const sub =
            (payload.mb_id as string) ||
            (payload.sub as string) ||
            (payload.user_id as string) ||
            '';
        if (!sub) return null;
        return {
            sub,
            nickname:
                (payload.mb_name as string) ||
                (payload.mb_nick as string) ||
                (payload.nickname as string) ||
                '',
            level: (payload.mb_level as number) || (payload.level as number) || 0,
            email: (payload.mb_email as string) || (payload.email as string) || ''
        };
    } catch {
        return null;
    }
}

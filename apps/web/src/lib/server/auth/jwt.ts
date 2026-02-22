/**
 * JWT 생성/검증
 * Go 백엔드와 동일한 JWT_SECRET + HS256 사용 → 호환성 유지
 */
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || '';
const DAMOANG_JWT_SECRET = process.env.DAMOANG_JWT_SECRET || '';

const secret = new TextEncoder().encode(JWT_SECRET);
const damoangSecret = new TextEncoder().encode(DAMOANG_JWT_SECRET);

export interface JwtPayload {
    sub: string; // mb_id
    nickname: string;
    level: number;
    email: string;
}

/** Access Token 생성 (15분) */
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

/** Refresh Token 생성 (7일) */
export async function generateRefreshToken(mbId: string): Promise<string> {
    return new SignJWT({ sub: mbId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .setIssuer('angple')
        .sign(secret);
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

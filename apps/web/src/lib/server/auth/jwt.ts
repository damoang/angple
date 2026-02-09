/**
 * JWT 생성/검증
 * Go 백엔드와 동일한 JWT_SECRET + HS256 사용 → 호환성 유지
 */
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
    console.warn('[JWT] JWT_SECRET 환경변수가 설정되지 않았습니다');
}

const secret = new TextEncoder().encode(JWT_SECRET);

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

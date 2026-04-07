/**
 * JWT 인증 유틸리티 — muzia-api와 동일한 JWT 시크릿으로 토큰 검증
 */

export interface JwtPayload {
    user_id: string;
    username: string;
    nickname: string;
    level: number;
    exp: number;
}

/** mb_id (문자열 아이디) 반환 — user_id가 숫자면 username 사용 */
export function getMbId(user: JwtPayload): string {
    return user.username || user.user_id;
}

export function verifyJwt(token: string): JwtPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf-8')
        );

        // 만료 확인
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return null;
        }

        return payload as JwtPayload;
    } catch {
        return null;
    }
}

export function getUserFromRequest(request: Request): JwtPayload | null {
    // Authorization: Bearer <token>
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
        return verifyJwt(auth.slice(7));
    }

    // Cookie: token=<token>
    const cookie = request.headers.get('cookie');
    if (cookie) {
        const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (match) {
            return verifyJwt(match[1]);
        }
    }

    return null;
}

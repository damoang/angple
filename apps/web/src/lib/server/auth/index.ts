/**
 * 서버 사이드 인증 유틸리티
 */
import { verifyToken, type JwtPayload } from './jwt.js';
import type { Cookies } from '@sveltejs/kit';

export interface AuthUser {
	mb_id: string;
	mb_name: string;
	mb_level: number;
	mb_email: string;
}

/**
 * 쿠키에서 인증 사용자 정보 추출
 * access_token 쿠키 → JWT 검증 → 사용자 정보 반환
 */
export async function getAuthUser(cookies: Cookies): Promise<AuthUser | null> {
	const token = cookies.get('access_token');
	if (!token) return null;

	const payload = await verifyToken(token);
	if (!payload) return null;

	return {
		mb_id: payload.sub,
		mb_name: payload.nickname,
		mb_level: payload.level,
		mb_email: payload.email
	};
}

export { verifyToken, generateAccessToken, generateRefreshToken } from './jwt.js';
export type { JwtPayload } from './jwt.js';

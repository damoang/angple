/**
 * damoang_jwt SSO 쿠키 관리
 * .damoang.net 도메인에 발급하여 ads.damoang.net 등 Go 서비스에서 인증 가능하도록 함
 */
import { generateDamoangJWT } from './jwt.js';

const SSO_COOKIE_NAME = 'damoang_jwt';
const SSO_COOKIE_DOMAIN = '.damoang.net';
const SSO_COOKIE_MAX_AGE = 3600; // 1시간

/** 로그인 성공 시 damoang_jwt 쿠키 설정 */
export async function setDamoangSSOCookie(
    cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void },
    member: { mb_id: string; mb_level: number; mb_name: string; mb_email: string }
): Promise<void> {
    const token = await generateDamoangJWT(member);
    cookies.set(SSO_COOKIE_NAME, token, {
        path: '/',
        domain: SSO_COOKIE_DOMAIN,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SSO_COOKIE_MAX_AGE
    });
}

/** 로그아웃 시 damoang_jwt 쿠키 삭제 */
export function clearDamoangSSOCookie(cookies: {
    delete: (name: string, opts: Record<string, unknown>) => void;
}): void {
    cookies.delete(SSO_COOKIE_NAME, {
        path: '/',
        domain: SSO_COOKIE_DOMAIN,
        httpOnly: true,
        secure: true
    });
}

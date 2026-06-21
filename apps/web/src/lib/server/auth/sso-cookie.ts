/**
 * damoang_jwt SSO 쿠키 관리
 *
 * env COOKIE_DOMAIN 기반으로 발급 (예: .muzia.net → editor.muzia.net 공유,
 * .damoang.net → ads.damoang.net 공유). env 미설정 시 host-only.
 */
import { env } from '$env/dynamic/private';
import { generateDamoangJWT } from './jwt.js';

const SSO_COOKIE_NAME = 'damoang_jwt';
const SSO_COOKIE_DOMAIN = env.COOKIE_DOMAIN || env.SSO_COOKIE_DOMAIN || '';
const SSO_COOKIE_MAX_AGE = 86400; // 24시간

/** 로그인 성공 시 damoang_jwt 쿠키 설정 */
export async function setDamoangSSOCookie(
    cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void },
    member: { mb_id: string; mb_level: number; mb_name: string; mb_email: string }
): Promise<void> {
    const token = await generateDamoangJWT(member);
    const opts: Record<string, unknown> = {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SSO_COOKIE_MAX_AGE
    };
    if (SSO_COOKIE_DOMAIN) opts.domain = SSO_COOKIE_DOMAIN;
    console.log(`[SSO] setDamoangSSOCookie mb_id=${member.mb_id} domain=${SSO_COOKIE_DOMAIN || '(host-only)'} tokenLen=${token.length}`);
    cookies.set(SSO_COOKIE_NAME, token, opts);
}

/** 로그아웃 시 damoang_jwt 쿠키 삭제 */
export function clearDamoangSSOCookie(cookies: {
    delete: (name: string, opts: Record<string, unknown>) => void;
}): void {
    const opts: Record<string, unknown> = {
        path: '/',
        httpOnly: true,
        secure: true
    };
    if (SSO_COOKIE_DOMAIN) opts.domain = SSO_COOKIE_DOMAIN;
    cookies.delete(SSO_COOKIE_NAME, opts);
}

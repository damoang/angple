/**
 * Cloudflare Turnstile CAPTCHA 서버 검증
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';

/**
 * Turnstile 토큰 검증
 * @param token 클라이언트에서 전달된 cf-turnstile-response
 * @param ip 클라이언트 IP
 * @returns 검증 성공 여부
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
    if (!TURNSTILE_SECRET_KEY) {
        return true;
    }

    if (!token) {
        return false;
    }

    try {
        const res = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: TURNSTILE_SECRET_KEY,
                response: token,
                remoteip: ip
            })
        });

        if (!res.ok) {
            console.error('[Captcha] Turnstile API 응답 오류:', res.status);
            return false;
        }

        const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };

        return data.success;
    } catch (err) {
        console.error('[Captcha] Turnstile 검증 중 예외:', err);
        return false;
    }
}

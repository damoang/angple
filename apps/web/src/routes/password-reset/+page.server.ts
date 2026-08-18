/**
 * 비밀번호 찾기 - 이메일 입력 페이지
 */
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
    findMemberByEmailForReset,
    createPasswordResetToken,
    sendPasswordResetEmail
} from '$lib/server/auth/password-reset.js';
import { verifyTurnstile } from '$lib/server/captcha.js';
import { checkRateLimit, recordAttempt, resolveClientIp } from '$lib/server/rate-limit.js';

export const actions: Actions = {
    default: async ({ request, getClientAddress }) => {
        // [B 인증·남용 방지] IP 를 못 구해도 **제한을 건너뛰지 않는다.**
        // ⛔ 건너뛰면 로그인·가입 무제한 시도가 조용히 열린다. 막히면 즉시 제보가 들어오지만
        //    뚫리면 아무도 모른다 — fail-closed 를 택한다(2026-08-19).
        // ⛔ 기록·캡차에는 공용 버킷 키를 쓰지 않는다. 'unknown' 이 mb_ip 에 저장되거나
        //    Turnstile remoteip 로 나가면 데이터가 오염되고 검증이 깨진다.
        const resolvedIp = resolveClientIp(getClientAddress, request);
        const clientIp = resolvedIp ?? '';
        const rateKey = resolvedIp ?? 'unknown';
        const formData = await request.formData();
        const email = (formData.get('email') as string)?.trim() || '';

        // Rate limit 체크 (5회/시간)
        const rateCheck = checkRateLimit(rateKey, 'password-reset', 5, 60 * 60 * 1000);
        if (!rateCheck.allowed) {
            return fail(429, {
                error: `요청이 너무 많습니다. ${rateCheck.retryAfter}초 후 다시 시도해주세요.`,
                email
            });
        }
        recordAttempt(rateKey, 'password-reset');

        // Turnstile CAPTCHA 검증
        const turnstileToken = (formData.get('cf-turnstile-response') as string) || '';
        const captchaValid = await verifyTurnstile(turnstileToken, clientIp);
        if (!captchaValid) {
            return fail(400, {
                error: '자동 요청 방지 확인에 실패했습니다. 다시 시도해주세요.',
                email
            });
        }

        if (!email) {
            return fail(400, { error: '이메일을 입력해주세요.', email });
        }

        // 이메일 형식 검증 (RFC 5321 길이 제한 + 기본 형식)
        if (
            email.length > 254 ||
            !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
                email
            )
        ) {
            return fail(400, { error: '올바른 이메일 주소를 입력해주세요.', email });
        }

        // 회원 조회
        const member = await findMemberByEmailForReset(email);

        // 보안: 회원이 없어도 성공으로 응답 (이메일 존재 여부 노출 방지)
        if (member) {
            try {
                const nonce = await createPasswordResetToken(member.mb_id);
                await sendPasswordResetEmail({
                    to: email,
                    nickname: member.mb_nick || member.mb_name,
                    mbNo: member.mb_no,
                    nonce
                });
            } catch (err) {
                console.error('[Password Reset] 메일 발송 실패:', err);
                // 메일 발송 실패해도 사용자에게는 성공 메시지 (보안)
            }
        }

        return { success: true, email };
    }
};

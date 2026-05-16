/**
 * 비회원 결제 → 자동 회원 생성 + 결제 시작 (옵션 B).
 *
 * 현재는 stub: 가맹점 심사 진행 중이라 실제 g5_member INSERT 와 결제 PG 호출은
 * 일어나지 않는다. 사용자 입력 검증 + 가맹 통과 후 진행 안내 메시지 응답.
 *
 * 가맹 통과 후 활성화 시:
 *   1. g5_member 이메일 중복 점검 → 있으면 "기존 회원" 응답 (로그인 유도)
 *   2. mb_id 자동 생성 (timestamp + random hex)
 *   3. 임시 비번 + bcrypt → g5_member INSERT (mb_level=1)
 *   4. payment 플러그인 /checkout/start 호출 (메타에 mb_id 포함)
 *   5. 결제 webhook 성공 시 환영 메일 + 비번 재설정 토큰 발송 → ad_free_membership 활성화
 */

export type AdFreePlanCode = 'ad_free_monthly' | 'ad_free_half_yearly';

export interface GuestCheckoutInput {
    plan: AdFreePlanCode;
    provider: 'naverpay' | 'paypal';
    email: string;
    nickname: string;
    agreements: Record<string, boolean>;
}

const VALID_PLANS: readonly AdFreePlanCode[] = ['ad_free_monthly', 'ad_free_half_yearly'];

export interface GuestCheckoutResult {
    status: 'pending_merchant_review' | 'redirect' | 'error';
    message?: string;
    redirect_url?: string;
}

const REQUIRED_AGREEMENTS = ['terms', 'privacy', 'recurring', 'auto_signup'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateGuestInput(input: GuestCheckoutInput): string | null {
    if (!input.email || !EMAIL_RE.test(input.email)) return '올바른 이메일 형식이 아닙니다.';
    const nick = (input.nickname ?? '').trim();
    if (nick.length < 2 || nick.length > 20) return '닉네임은 2~20자로 입력해주세요.';
    if (!VALID_PLANS.includes(input.plan)) return '잘못된 요금제입니다.';
    if (!['naverpay', 'paypal'].includes(input.provider)) return '잘못된 결제 수단입니다.';
    for (const a of REQUIRED_AGREEMENTS) {
        if (input.agreements?.[a] !== true) return `필수 약관 동의가 누락되었습니다: ${a}`;
    }
    return null;
}

export async function handleGuestCheckout(input: GuestCheckoutInput): Promise<GuestCheckoutResult> {
    const err = validateGuestInput(input);
    if (err) return { status: 'error', message: err };

    // 가맹점 심사 진행 중 — 실제 회원 생성/결제 호출 X.
    // 가맹 통과 후 isMerchantApproved=true 로 전환되면 아래 stub 을 실제 흐름으로 교체:
    //   1. checkExistingMember(input.email)
    //   2. createGuestMember(input)
    //   3. paymentPluginStartCheckout({ plan, provider, mb_id })
    //   4. sendWelcomeEmail(input.email, resetToken)
    return {
        status: 'pending_merchant_review',
        message:
            '가맹점 심사 진행 중입니다. 입력해주신 이메일(' +
            input.email +
            ')로 가맹 통과 후 결제 안내를 보내드립니다. 감사합니다.'
    };
}

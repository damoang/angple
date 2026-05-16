import { describe, it, expect } from 'vitest';
import { validateGuestInput, handleGuestCheckout } from '../guest-checkout';
import type { GuestCheckoutInput } from '../guest-checkout';

function base(overrides: Partial<GuestCheckoutInput> = {}): GuestCheckoutInput {
    return {
        plan: 'ad_free_half_yearly',
        provider: 'naverpay',
        email: 'guest@example.com',
        nickname: 'guest',
        agreements: { terms: true, privacy: true, recurring: true, auto_signup: true },
        ...overrides
    };
}

describe('validateGuestInput', () => {
    it('모든 필드 정상 → null', () => {
        expect(validateGuestInput(base())).toBeNull();
    });

    it('이메일 형식 오류 → 에러 메시지', () => {
        expect(validateGuestInput(base({ email: 'not-an-email' }))).toMatch(/이메일/);
    });

    it('닉네임 1자 → 에러', () => {
        expect(validateGuestInput(base({ nickname: 'a' }))).toMatch(/닉네임/);
    });

    it('닉네임 21자 → 에러', () => {
        expect(validateGuestInput(base({ nickname: 'a'.repeat(21) }))).toMatch(/닉네임/);
    });

    it('잘못된 plan → 에러', () => {
        expect(validateGuestInput(base({ plan: 'invalid' as never }))).toMatch(/요금제/);
    });

    it('잘못된 provider → 에러', () => {
        expect(validateGuestInput(base({ provider: 'kakaopay' as never }))).toMatch(/결제 수단/);
    });

    it('필수 약관 누락 (privacy) → 에러', () => {
        const input = base();
        input.agreements = { ...input.agreements, privacy: false };
        expect(validateGuestInput(input)).toMatch(/privacy/);
    });

    it('자동 회원 가입 동의 누락 → 에러', () => {
        const input = base();
        input.agreements = { ...input.agreements, auto_signup: false };
        expect(validateGuestInput(input)).toMatch(/auto_signup/);
    });
});

describe('handleGuestCheckout', () => {
    it('정상 입력 → pending_merchant_review + 이메일 echo', async () => {
        const res = await handleGuestCheckout(base());
        expect(res.status).toBe('pending_merchant_review');
        expect(res.message).toContain('guest@example.com');
    });

    it('유효성 실패 → status=error', async () => {
        const res = await handleGuestCheckout(base({ email: '' }));
        expect(res.status).toBe('error');
        expect(res.message).toMatch(/이메일/);
    });
});

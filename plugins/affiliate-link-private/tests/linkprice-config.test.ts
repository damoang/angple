import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLinkPriceAffiliateId, classifyLinkPriceFailure } from '../lib/platforms/linkprice';

/**
 * 2026-03 / 2026-07-16 두 차례 "LinkPrice 전량 변환 실패 → 수익 0" 사고의 재발 방지.
 *
 * 사고 메커니즘:
 *   M1. a_id 출처가 두 개(AFFI_LINKPRICE_AFF_ID || AFFI_AFFILIATE_ID)라, 우선순위가 높은 쪽에
 *       미승인 ID가 들어가면 승인된 값을 조용히 가렸다.
 *   M2. [-6](승인거부)이 설정오류 분류에서 빠져 merchant_denied 로 위장 → 경보 미발화 → 무성 출혈.
 */
describe('LinkPrice a_id 단일 출처 (M1 재발 방지)', () => {
    // 모듈이 `const env = process.env` 로 참조를 캡처하므로 객체를 교체하지 말고 제자리에서 복구한다.
    const saved = { ...process.env };
    const restore = () => {
        for (const k of ['AFFI_AFFILIATE_ID', 'AFFI_LINKPRICE_AFF_ID']) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
    };
    beforeEach(() => {
        delete process.env.AFFI_AFFILIATE_ID;
        delete process.env.AFFI_LINKPRICE_AFF_ID;
    });
    afterEach(restore);

    it('AFFI_AFFILIATE_ID 를 a_id 로 쓴다', () => {
        process.env.AFFI_AFFILIATE_ID = 'A100694456';
        expect(getLinkPriceAffiliateId()).toBe('A100694456');
    });

    it('AFFI_LINKPRICE_AFF_ID 는 무시한다 — 폴백을 되살리면 이 테스트가 깨진다', () => {
        process.env.AFFI_AFFILIATE_ID = 'A100694456';
        process.env.AFFI_LINKPRICE_AFF_ID = 'A100698498'; // 과거 사고에서 승인 ID를 가렸던 미승인 값
        expect(getLinkPriceAffiliateId()).toBe('A100694456');
    });

    it('AFFI_LINKPRICE_AFF_ID 만 있으면 a_id 없음으로 본다 (가릴 변수 자체가 없어야 한다)', () => {
        process.env.AFFI_LINKPRICE_AFF_ID = 'A100698498';
        expect(getLinkPriceAffiliateId()).toBe('');
    });

    it('따옴표째 들어와도 정제한다 (2026-07-10 [-3] 사고)', () => {
        process.env.AFFI_AFFILIATE_ID = "'A100694456'";
        expect(getLinkPriceAffiliateId()).toBe('A100694456');
    });
});

describe('LinkPrice 실패 분류 (M2 은폐 방지)', () => {
    const saved = { ...process.env };
    beforeEach(() => {
        process.env.AFFI_AFFILIATE_ID = 'A100694456';
    });
    afterEach(() => {
        if (saved.AFFI_AFFILIATE_ID === undefined) delete process.env.AFFI_AFFILIATE_ID;
        else process.env.AFFI_AFFILIATE_ID = saved.AFFI_AFFILIATE_ID;
    });

    const classify = (upstreamError: string) =>
        classifyLinkPriceFailure({
            originalUrl: 'https://product.kyobobook.co.kr/detail/S000220429584',
            normalizedUrl: 'https://product.kyobobook.co.kr/detail/S000220429584',
            upstreamError
        }).reasonCode;

    it('[-6] 승인거부 = 계정 문제 → config_error (merchant_denied 로 위장되면 안 된다)', () => {
        expect(classify('denied: LinkPrice F: [-6] 승인거부')).toBe('config_error');
    });

    it('[-3] a_id 형식오류 → config_error', () => {
        expect(classify('LinkPrice F: [-3] a_id 형식오류')).toBe('config_error');
    });

    it('개별 머천트 거부는 merchant_denied 로 유지 (과잉 경보 방지)', () => {
        expect(classify('LinkPrice F: 제휴 종료된 머천트')).toBe('merchant_denied');
    });

    it('a_id 미설정이면 env_missing', () => {
        delete process.env.AFFI_AFFILIATE_ID;
        expect(classify('LinkPrice F: whatever')).toBe('env_missing');
    });
});

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_PROMOTION_RULES,
    findApplicablePromotionRule,
    type PromotionEligibility
} from './auto-promotion.js';

describe('findApplicablePromotionRule', () => {
    const eligibleMember: PromotionEligibility = {
        mb_level: 2,
        as_exp: 3000,
        login_days: 7,
        mb_certify: 'simple'
    };

    it('returns the matching rule for certified members', () => {
        expect(findApplicablePromotionRule(eligibleMember, DEFAULT_PROMOTION_RULES)).toEqual(
            DEFAULT_PROMOTION_RULES[0]
        );
    });

    it('blocks promotion for uncertified members', () => {
        expect(
            findApplicablePromotionRule(
                {
                    ...eligibleMember,
                    mb_certify: ''
                },
                DEFAULT_PROMOTION_RULES
            )
        ).toBeNull();
    });

    it('blocks promotion when thresholds are not met', () => {
        expect(
            findApplicablePromotionRule(
                {
                    ...eligibleMember,
                    as_exp: 2500
                },
                DEFAULT_PROMOTION_RULES
            )
        ).toBeNull();
    });
});

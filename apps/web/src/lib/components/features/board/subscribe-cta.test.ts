import { describe, it, expect } from 'vitest';
import {
    isGroupBoard,
    formatMemberCount,
    subscribeCtaLabel,
    subscribeCtaTitle
} from './subscribe-cta.js';

describe('isGroupBoard', () => {
    it('group_id 가 group 이면 true', () => {
        expect(isGroupBoard('group')).toBe(true);
    });
    it('다른 group_id 는 false — 소모임 아닌 게시판 무영향', () => {
        expect(isGroupBoard('community')).toBe(false);
        expect(isGroupBoard('')).toBe(false);
        expect(isGroupBoard(null)).toBe(false);
        expect(isGroupBoard(undefined)).toBe(false);
    });
});

describe('formatMemberCount', () => {
    it('양수는 천단위 구분 + "명"', () => {
        expect(formatMemberCount(0)).toBe('멤버 0명');
        expect(formatMemberCount(3)).toBe('멤버 3명');
        expect(formatMemberCount(1234)).toBe('멤버 1,234명');
    });
    it('음수/비유한수는 0 으로 방어', () => {
        expect(formatMemberCount(-5)).toBe('멤버 0명');
        expect(formatMemberCount(Number.NaN)).toBe('멤버 0명');
        expect(formatMemberCount(Number.POSITIVE_INFINITY)).toBe('멤버 0명');
    });
    it('소수는 내림', () => {
        expect(formatMemberCount(2.9)).toBe('멤버 2명');
    });
});

describe('subscribeCtaLabel', () => {
    it('구독 여부에 따라 라벨 분기', () => {
        expect(subscribeCtaLabel(true)).toBe('멤버');
        expect(subscribeCtaLabel(false)).toBe('소모임 구독');
    });
});

describe('subscribeCtaTitle', () => {
    it('구독 중이면 멤버 상태 문구', () => {
        expect(subscribeCtaTitle('낚시', true, 12)).toContain('멤버');
        expect(subscribeCtaTitle('낚시', true, 12)).toContain('낚시');
        expect(subscribeCtaTitle('낚시', true, 12)).toContain('멤버 12명');
    });
    it('미구독이면 가입 유도 문구', () => {
        expect(subscribeCtaTitle('낚시', false, 0)).toContain('멤버가 되어');
        expect(subscribeCtaTitle('낚시', false, 0)).toContain('멤버 0명');
    });
});

import { describe, expect, it } from 'vitest';

import { formatLeaveDate, prependLeaveMemo } from './member-leave';

describe('member leave helpers', () => {
    it('formats leave date as YYYYMMDD', () => {
        expect(formatLeaveDate(new Date(2026, 2, 12, 1, 2, 3))).toBe('20260312');
    });

    it('prepends leave memo before existing memo', () => {
        expect(prependLeaveMemo('기존 메모', '20260312')).toBe('20260312 탈퇴함\n기존 메모');
        expect(prependLeaveMemo('', '20260312')).toBe('20260312 탈퇴함');
    });
});

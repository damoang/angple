/**
 * computeWithdrawalGrace 경계값 회귀 가드
 *
 * ⛔ 이 파일이 생긴 이유
 * 2026-08-25 백엔드 common.WithdrawalGraceDays 를 30 → 0 으로 내렸는데,
 * 웹이 같은 판정을 자체 상수로 따로 하고 있어 30 인 채로 남았다. 그 결과
 * 탈퇴한 회원이 소셜 로그인하면 "남은 기간 23일"과 "이미 탈퇴가 확정되어
 * 취소할 수 없습니다"가 한 화면에 같이 뜨고, 취소 버튼이 먹지 않았다.
 * 실사용자 한 분이 메일로 문의해 계정을 수동 복원했다.
 *
 * 그때 이 함수를 덮는 테스트가 하나도 없었다. 상수를 30 으로 되돌려도
 * CI 는 초록이었다. 같은 사고를 다시 내지 않으려고 남긴다.
 */
import { describe, it, expect } from 'vitest';
import { computeWithdrawalGrace, WITHDRAWAL_GRACE_DAYS } from './withdrawal';
import type { MemberRow } from './oauth/types';

/** n일 전(음수면 미래) 자정 기준 YYYYMMDD */
function ymdOffset(days: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return (
        `${d.getFullYear()}` +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0')
    );
}

/** computeWithdrawalGrace 가 실제로 보는 필드는 두 개뿐이다. 나머지는 형식만 채운다. */
const member = (leaveDate: string | null, reason = 'self'): MemberRow => ({
    mb_id: 'test_user',
    mb_no: 1,
    mb_name: '테스트',
    mb_nick: '테스트',
    mb_email: 'test@example.com',
    mb_level: 2,
    mb_point: 0,
    mb_today_login: '',
    mb_login_ip: '',
    mb_leave_date: leaveDate ?? '',
    mb_leave_reason: reason,
    mb_intercept_date: '',
    mb_certify: '',
    mb_image_url: '',
    mb_image_updated_at: null,
    as_level: 1
});

describe('WITHDRAWAL_GRACE_DAYS', () => {
    // ⛔ 이 단언이 이 파일의 핵심이다. 백엔드 common.WithdrawalGraceDays 와
    //    같은 값이어야 한다. 한쪽만 바꾸면 회원에게 듣지 않는 버튼이 보인다.
    //    값을 바꿔야 한다면 백엔드·개인정보처리방침 제2조③과 함께 바꾸고
    //    이 테스트도 같이 고쳐라.
    it('백엔드와 같은 0 이어야 한다', () => {
        expect(WITHDRAWAL_GRACE_DAYS).toBe(0);
    });
});

describe('computeWithdrawalGrace', () => {
    it('탈퇴 신청이 없으면 null — 정상 회원 경로에 영향이 없어야 한다', () => {
        expect(computeWithdrawalGrace(member(null))).toBeNull();
        expect(computeWithdrawalGrace(member(''))).toBeNull();
    });

    // 숙려 0일의 본체 — 오늘 이하 어떤 날짜도 취소 화면이 뜨면 안 된다.
    it.each([
        ['오늘 신청', 0],
        ['어제 신청', 1],
        ['7일 전', 7],
        ['30일 전', 30],
        ['1년 전', 365]
    ])('%s → inGrace=false (취소 화면 안 뜸)', (_label, daysAgo) => {
        const r = computeWithdrawalGrace(member(ymdOffset(daysAgo as number)));
        expect(r?.inGrace).toBe(false);
        expect(r?.daysRemaining).toBe(0);
    });

    it('날짜 파싱 실패는 취소 불가로 처리한다 (fail-closed)', () => {
        for (const bad of ['abc', '2026', '00000000', '202608']) {
            const r = computeWithdrawalGrace(member(bad));
            expect(r?.inGrace).toBe(false);
        }
    });

    it('관리자 처리 탈퇴는 사유만으로 취소 불가다', () => {
        for (const reason of ['admin', 'terms_violation', 'contract_withdrawal', 'account_abuse']) {
            expect(computeWithdrawalGrace(member(ymdOffset(0), reason))?.inGrace).toBe(false);
        }
    });

    it('신청일·확정예정일을 YYYY-MM-DD 로 돌려준다', () => {
        const r = computeWithdrawalGrace(member('20260819'));
        expect(r?.leaveDate).toBe('2026-08-19');
        // GRACE_DAYS=0 이므로 확정 예정일 = 신청일
        expect(r?.deadline).toBe('2026-08-19');
    });

    // ⚠️ 알려진 경계. Math.max(0, ...) 는 음수만 자르므로 미래 일자는 양수가 된다.
    //    mb_leave_date 를 기록하는 세 경로(backend member_leave_handler.go /
    //    admin_member_handler.go, web member-leave.ts)가 모두 "오늘"만 쓰므로
    //    정상 경로로는 생기지 않는다. 수동 SQL 로 넣을 때만 주의하면 된다.
    //    이 동작을 고칠 생각이라면 이 테스트가 먼저 빨개진다.
    it('미래 일자는 inGrace=true 가 된다 — 정상 경로로는 생기지 않는 값', () => {
        const r = computeWithdrawalGrace(member(ymdOffset(-3)));
        expect(r?.daysRemaining).toBeGreaterThan(0);
        expect(r?.inGrace).toBe(true);
    });
});

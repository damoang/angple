/**
 * g5_member 테이블 조회/업데이트
 *
 * 2-tier 캐시: L1(Map, 1분) → L2(Redis, 5분) → DB
 */
import pool from '$lib/server/db.js';
import { TieredCache } from '$lib/server/cache.js';
import type { RowDataPacket } from 'mysql2';
import type { MemberRow } from './types.js';

// L1: 1분, L2: 5분(300초), 최대 1,000 항목
// 2026-04-26: maxL1 5000 → 1000 (pod 메모리 -20~50 MB).
// L2 Redis fallback 으로 hit% 영향 미미 (실 동시 활성 멤버 < 2000).
const memberCache = new TieredCache<MemberRow>('member', 60_000, 300, 1000);

/** 멤버 캐시 무효화 (로그아웃, 회원정보 변경 시 호출) */
export async function invalidateMemberCache(mbId: string): Promise<void> {
    await memberCache.delete(mbId);
}

/** 회원 ID로 조회 (2-tier 캐시) */
export async function getMemberById(mbId: string): Promise<MemberRow | null> {
    // L1 → L2 → DB
    const cached = await memberCache.get(mbId);
    if (cached) return cached;

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_no, mb_name, mb_nick, mb_email, mb_level, mb_point,
		        mb_today_login, mb_login_ip, mb_leave_date, mb_leave_reason, mb_intercept_date, mb_certify,
		        COALESCE(mb_image_url, '') AS mb_image_url,
		        mb_image_updated_at,
		        COALESCE(as_level, 0) AS as_level
		 FROM g5_member
		 WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    const member = (rows[0] as MemberRow) || null;

    if (member) {
        if (member.mb_level === 5) {
            const [promotionRows] = await pool.query<RowDataPacket[]>(
                `SELECT end_date AS advertiser_end_date,
                        CASE
                            WHEN is_active = 1 AND start_date <= CURDATE() AND end_date >= CURDATE() THEN 'ongoing'
                            WHEN end_date < CURDATE() THEN 'expired'
                            WHEN is_active = 1 AND start_date > CURDATE() THEN 'scheduled'
                            ELSE 'inactive'
                        END AS advertiser_status
                 FROM promotions
                 WHERE member_id = ?
                 ORDER BY
                     CASE
                         WHEN is_active = 1 AND start_date <= CURDATE() AND end_date >= CURDATE() THEN 0
                         WHEN is_active = 1 AND end_date >= CURDATE() THEN 1
                         ELSE 2
                     END,
                     end_date DESC
                 LIMIT 1`,
                [mbId]
            );

            const promotion = (promotionRows[0] as
                | Pick<MemberRow, 'advertiser_end_date' | 'advertiser_status'>
                | undefined) ?? {
                advertiser_end_date: null,
                advertiser_status: null
            };

            member.advertiser_end_date = promotion.advertiser_end_date ?? null;
            member.advertiser_status = promotion.advertiser_status ?? null;
        }

        await memberCache.set(mbId, member);
    }
    return member;
}

/** 이메일로 회원 조회 (탈퇴 제외, 이용제한 회원도 로그인 허용) */
export async function findMemberByEmail(email: string): Promise<MemberRow | null> {
    if (!email) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_no, mb_name, mb_nick, mb_email, mb_level, mb_point,
		        mb_today_login, mb_login_ip, mb_leave_date, mb_leave_reason, mb_intercept_date, mb_certify,
		        COALESCE(mb_image_url, '') AS mb_image_url,
		        mb_image_updated_at,
		        COALESCE(as_level, 0) AS as_level
		 FROM g5_member
		 WHERE mb_email = ? AND mb_leave_date = ''
		 ORDER BY mb_datetime ASC
		 LIMIT 1`,
        [email]
    );
    return (rows[0] as MemberRow) || null;
}

/**
 * 로그인 시각/IP 업데이트.
 * - 본인 탈퇴(reason = 'self' 또는 빈 값) 후 재로그인 → mb_leave_date 클리어(자동 복귀).
 * - 관리자가 처리한 탈퇴(admin/terms_violation/contract_withdrawal/account_abuse) →
 *   mb_leave_date 보존, 재로그인으로 탈퇴 취소되지 않도록 보호.
 */
export async function updateLoginTimestamp(
    mbId: string,
    ip: string,
    leaveReason?: string
): Promise<void> {
    const PROTECTED_REASONS = new Set([
        'admin',
        'terms_violation',
        'contract_withdrawal',
        'account_abuse'
    ]);
    const isAdminDeactivated = leaveReason && PROTECTED_REASONS.has(leaveReason);

    if (isAdminDeactivated) {
        // 관리자 처리 탈퇴: mb_leave_date 보존, 로그인 시각만 업데이트
        await pool.query(
            'UPDATE g5_member SET mb_today_login = NOW(), mb_login_ip = ? WHERE mb_id = ?',
            [ip, mbId]
        );
    } else {
        // 본인 탈퇴(또는 reason 없음): mb_leave_date 클리어 → 자동 복귀
        await pool.query(
            "UPDATE g5_member SET mb_today_login = NOW(), mb_login_ip = ?, mb_leave_date = '' WHERE mb_id = ?",
            [ip, mbId]
        );
    }
    await invalidateMemberCache(mbId);
}

/** 로그인 차단 사유는 "탈퇴" 한 가지만. 이용제한(mb_intercept_date) 은 로그인 차단 사유가 아님.
 *
 *  운영 정책 (2026-05-15):
 *  - **탈퇴자(mb_leave_date set)만 OAuth 로그인 차단**.
 *  - 이용제한(mb_intercept_date 가 진짜 날짜) 회원도 로그인은 허용 — 본인이 소명할 수
 *    있어야 하기 때문. 글/댓글 작성 같은 활동 제한은 별도 ban-check 미들웨어가 담당.
 *  - 자발적 탈퇴(reason='self' 또는 빈 값) 의 자동 복귀는 updateLoginTimestamp 가 처리.
 *  - 관리자 처리 탈퇴(admin / terms_violation / contract_withdrawal / account_abuse) 는
 *    PROTECTED_REASONS 가 mb_leave_date 를 보존 → 이 함수에서 false 반환 → 로그인 차단.
 */
export function isMemberActive(member: MemberRow): boolean {
    if (member.mb_leave_date) return false;
    return true;
}

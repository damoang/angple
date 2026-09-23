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
 *
 * ⛔ mb_leave_date 는 건드리지 않는다. 예전엔 본인 탈퇴(self/빈값) 재로그인에서 여기서 탈퇴를
 *    해제했다(자동 복귀). 2026-09-23 사장님 결정으로 자동 복귀를 없앴다 — 「복귀가 쉬우면
 *    탈퇴하기도 쉽다」. 그리고 게이트가 캐시된 옛 회원(memberCache L1 60s)을 보고 통과한 뒤
 *    이 UPDATE 가 탈퇴를 지워버리던 뒷문(탈퇴 9~41초 뒤 재로그인 4건, 기록 0)도 이걸로 닫힌다.
 *    복귀는 운영 복원(recovery 서비스)만 한다. leaveReason 인자는 호출부 호환용으로 남기되
 *    더 이상 판정에 쓰지 않는다.
 */
export async function updateLoginTimestamp(
    mbId: string,
    ip: string,
    _leaveReason?: string
): Promise<void> {
    await pool.query(
        'UPDATE g5_member SET mb_today_login = NOW(), mb_login_ip = ? WHERE mb_id = ?',
        [ip, mbId]
    );
    await invalidateMemberCache(mbId);
}

/**
 * 탈퇴/제재 상태를 **캐시 없이** DB(writer)에서 직접 읽는다 — 로그인 게이트 전용.
 *
 * 왜: memberCache 는 L1(Map 60s)→L2(Redis 300s) 인데, 탈퇴는 Go 백엔드(POST /me/leave)가 DB 에
 * 쓴다. 백엔드가 L2 키는 지워도 각 파드의 L1 은 못 지운다 → 탈퇴 직후 60초 안에 같은 소셜로
 * 재로그인하면 게이트가 옛 회원(활성)을 보고 통과했다(2026-09-23 실측 4건). 활성/탈퇴 판정만은
 * 이 함수로 DB 를 직독한다. readPool(리플리카)이 아니라 pool(writer)을 쓰는 이유도 같다 — 복제 지연.
 * 반환 null = 회원 없음.
 */
export async function getMemberLeaveStateLive(
    mbId: string
): Promise<{ leaveDate: string; leaveReason: string; interceptDate: string } | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(mb_leave_date, '')     AS mb_leave_date,
                COALESCE(mb_leave_reason, '')   AS mb_leave_reason,
                COALESCE(mb_intercept_date, '') AS mb_intercept_date
           FROM g5_member WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    const r = rows[0];
    if (!r) return null;
    return {
        leaveDate: String(r.mb_leave_date ?? ''),
        leaveReason: String(r.mb_leave_reason ?? ''),
        interceptDate: String(r.mb_intercept_date ?? '')
    };
}

/** 로그인 차단 사유는 "탈퇴" 한 가지만. 이용제한(mb_intercept_date) 은 로그인 차단 사유가 아님.
 *
 *  운영 정책 (2026-05-15):
 *  - **탈퇴자(mb_leave_date set)만 OAuth 로그인 차단**.
 *  - 이용제한(mb_intercept_date 가 진짜 날짜) 회원도 로그인은 허용 — 본인이 소명할 수
 *    있어야 하기 때문. 글/댓글 작성 같은 활동 제한은 별도 ban-check 미들웨어가 담당.
 *  - 자동 복귀 없음(2026-09-23 결정). 탈퇴자는 운영 복원(recovery)만 — updateLoginTimestamp 는 mb_leave_date 를 건드리지 않는다.
 *  - 관리자 처리 탈퇴(admin / terms_violation / contract_withdrawal / account_abuse) 는
 *    withdrawal.ts PROTECTED_LEAVE_REASONS 가 mb_leave_date 를 보존 → 이 함수에서 false 반환 → 로그인 차단.
 */
export function isMemberActive(member: MemberRow): boolean {
    if (member.mb_leave_date) return false;
    return true;
}

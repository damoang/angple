/**
 * g5_member 테이블 조회/업데이트
 *
 * 2-tier 캐시: L1(Map, 1분) → L2(Redis, 5분) → DB
 */
import pool from '$lib/server/db.js';
import { TieredCache } from '$lib/server/cache.js';
import type { RowDataPacket } from 'mysql2';
import type { MemberRow } from './types.js';

// L1: 1분, L2: 5분(300초), 최대 5,000 항목
const memberCache = new TieredCache<MemberRow>('member', 60_000, 300, 5000);

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
        `SELECT mb_id, mb_name, mb_nick, mb_email, mb_level, mb_point,
		        mb_today_login, mb_login_ip, mb_leave_date, mb_intercept_date, mb_certify,
		        COALESCE(mb_image_url, '') AS mb_image_url,
		        mb_image_updated_at,
		        COALESCE(as_level, 0) AS as_level
		 FROM g5_member
		 WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    const member = (rows[0] as MemberRow) || null;

    if (member) {
        await memberCache.set(mbId, member);
    }
    return member;
}

/** 이메일로 회원 조회 (탈퇴 제외, 이용제한 회원도 로그인 허용) */
export async function findMemberByEmail(email: string): Promise<MemberRow | null> {
    if (!email) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_name, mb_nick, mb_email, mb_level, mb_point,
		        mb_today_login, mb_login_ip, mb_leave_date, mb_intercept_date, mb_certify,
		        COALESCE(mb_image_url, '') AS mb_image_url,
		        mb_image_updated_at,
		        COALESCE(as_level, 0) AS as_level
		 FROM g5_member
		 WHERE mb_email = ? AND mb_leave_date = ''
		 LIMIT 1`,
        [email]
    );
    return (rows[0] as MemberRow) || null;
}

/** 로그인 시각/IP 업데이트 */
export async function updateLoginTimestamp(mbId: string, ip: string): Promise<void> {
    await pool.query(
        'UPDATE g5_member SET mb_today_login = NOW(), mb_login_ip = ? WHERE mb_id = ?',
        [ip, mbId]
    );
    await invalidateMemberCache(mbId);
}

/** 회원이 활성 상태인지 확인 (탈퇴 여부만 체크) */
export function isMemberActive(member: MemberRow): boolean {
    return !member.mb_leave_date;
}

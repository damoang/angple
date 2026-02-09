/**
 * g5_member 테이블 조회/업데이트
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import type { MemberRow } from './types.js';

/** 회원 ID로 조회 */
export async function getMemberById(mbId: string): Promise<MemberRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_name, mb_nick, mb_email, mb_level, mb_point,
		        mb_today_login, mb_login_ip, mb_leave_date, mb_intercept_date
		 FROM g5_member
		 WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    return (rows[0] as MemberRow) || null;
}

/** 이메일로 회원 조회 (탈퇴/차단 제외) */
export async function findMemberByEmail(email: string): Promise<MemberRow | null> {
    if (!email) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_name, mb_nick, mb_email, mb_level, mb_point,
		        mb_today_login, mb_login_ip, mb_leave_date, mb_intercept_date
		 FROM g5_member
		 WHERE mb_email = ? AND mb_leave_date = '' AND mb_intercept_date = ''
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
}

/** 회원이 활성 상태인지 확인 (탈퇴/차단 여부) */
export function isMemberActive(member: MemberRow): boolean {
    return !member.mb_leave_date && !member.mb_intercept_date;
}

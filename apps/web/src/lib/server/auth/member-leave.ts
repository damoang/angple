/**
 * 회원 탈퇴 처리
 * PHP member_leave.php 호환 — 소프트 삭제 (mb_leave_date 설정)
 */
import pool from '$lib/server/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * 회원 탈퇴 처리 (소프트 삭제)
 * 1. mb_leave_date = CURDATE()
 * 2. 소셜 프로필 삭제
 */
export async function processMemberLeave(mbId: string): Promise<{ success: boolean; error?: string }> {
	// 회원 존재 확인
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT mb_id, mb_leave_date FROM g5_member WHERE mb_id = ? AND mb_leave_date = '' LIMIT 1",
		[mbId]
	);

	if (!rows[0]) {
		return { success: false, error: '회원 정보를 찾을 수 없거나 이미 탈퇴한 회원입니다.' };
	}

	// 소프트 삭제: mb_leave_date 설정
	await pool.query<ResultSetHeader>(
		'UPDATE g5_member SET mb_leave_date = CURDATE() WHERE mb_id = ?',
		[mbId]
	);

	// 소셜 프로필 삭제
	await pool.query<ResultSetHeader>(
		'DELETE FROM g5_member_social_profiles WHERE mb_id = ?',
		[mbId]
	);

	return { success: true };
}

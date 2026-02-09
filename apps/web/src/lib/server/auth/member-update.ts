/**
 * 회원 프로필 관리 (닉네임/이메일/비밀번호/설정 변경)
 * PHP member_confirm_update.php 호환
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import { validateNickname } from './register.js';

/** 프로필 전체 정보 조회 */
export interface MemberFullProfile {
	mb_id: string;
	mb_nick: string;
	mb_email: string;
	mb_homepage: string;
	mb_signature: string;
	mb_open: number;
	mb_mailling: number;
	mb_nick_date: string;
	mb_hp: string;
	mb_password: string;
	mb_leave_date: string;
	mb_intercept_date: string;
	mb_level: number;
}

/** 프로필 전체 정보 조회 */
export async function getMemberFullProfile(mbId: string): Promise<MemberFullProfile | null> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT mb_id, mb_nick, mb_email, mb_homepage, mb_signature,
		        mb_open, mb_mailling, mb_nick_date, mb_hp, mb_password,
		        mb_leave_date, mb_intercept_date, mb_level
		 FROM g5_member WHERE mb_id = ? LIMIT 1`,
		[mbId]
	);
	return (rows[0] as MemberFullProfile) || null;
}

/**
 * 닉네임 변경
 * - register.ts의 validateNickname() 재사용
 * - mb_nick_date 30일 쿨다운 체크
 */
export async function updateNickname(
	mbId: string,
	newNick: string
): Promise<{ success: boolean; error?: string }> {
	const trimmed = newNick.trim();

	// 현재 프로필 조회
	const profile = await getMemberFullProfile(mbId);
	if (!profile) return { success: false, error: '회원 정보를 찾을 수 없습니다.' };

	// 같은 닉네임이면 스킵
	if (profile.mb_nick === trimmed) {
		return { success: false, error: '현재 닉네임과 동일합니다.' };
	}

	// 30일 쿨다운 체크
	if (profile.mb_nick_date) {
		const lastChange = new Date(profile.mb_nick_date);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays < 30) {
			const remaining = 30 - diffDays;
			return {
				success: false,
				error: `닉네임은 30일에 한 번만 변경할 수 있습니다. (${remaining}일 후 변경 가능)`
			};
		}
	}

	// 닉네임 유효성 검사 (중복 체크 포함)
	const validation = await validateNickname(trimmed);
	if (!validation.valid) {
		return { success: false, error: validation.error };
	}

	// UPDATE
	await pool.query<ResultSetHeader>(
		'UPDATE g5_member SET mb_nick = ?, mb_nick_date = CURDATE() WHERE mb_id = ?',
		[trimmed, mbId]
	);

	return { success: true };
}

/**
 * 이메일 변경
 * - 형식 검증 + 중복 체크
 */
export async function updateEmail(
	mbId: string,
	newEmail: string
): Promise<{ success: boolean; error?: string }> {
	const trimmed = newEmail.trim().toLowerCase();

	// 이메일 형식 검증
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(trimmed)) {
		return { success: false, error: '올바른 이메일 형식이 아닙니다.' };
	}

	// 현재 프로필 조회
	const profile = await getMemberFullProfile(mbId);
	if (!profile) return { success: false, error: '회원 정보를 찾을 수 없습니다.' };

	// 같은 이메일이면 스킵
	if (profile.mb_email === trimmed) {
		return { success: false, error: '현재 이메일과 동일합니다.' };
	}

	// 중복 체크 (다른 회원)
	const [rows] = await pool.query<RowDataPacket[]>(
		'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_email = ? AND mb_id != ?',
		[trimmed, mbId]
	);
	if ((rows[0]?.cnt || 0) > 0) {
		return { success: false, error: '이미 사용 중인 이메일입니다.' };
	}

	// UPDATE
	await pool.query<ResultSetHeader>('UPDATE g5_member SET mb_email = ? WHERE mb_id = ?', [
		trimmed,
		mbId
	]);

	return { success: true };
}

/**
 * 비밀번호 변경
 * - 현재 비밀번호 검증 → 새 비밀번호 해싱 → UPDATE
 */
export async function changePassword(
	mbId: string,
	currentPw: string,
	newPw: string
): Promise<{ success: boolean; error?: string }> {
	if (!currentPw || !newPw) {
		return { success: false, error: '비밀번호를 입력해주세요.' };
	}

	if (newPw.length < 4) {
		return { success: false, error: '새 비밀번호는 4자 이상이어야 합니다.' };
	}

	// 현재 비밀번호 조회
	const profile = await getMemberFullProfile(mbId);
	if (!profile) return { success: false, error: '회원 정보를 찾을 수 없습니다.' };

	// 현재 비밀번호 검증
	const isMatch = await bcrypt.compare(currentPw, profile.mb_password);
	if (!isMatch) {
		return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
	}

	// 새 비밀번호 해싱
	const hashedPw = await bcrypt.hash(newPw, 10);

	// UPDATE
	await pool.query<ResultSetHeader>('UPDATE g5_member SET mb_password = ? WHERE mb_id = ?', [
		hashedPw,
		mbId
	]);

	return { success: true };
}

/**
 * 프로필 설정 업데이트
 * - 홈페이지, 서명, 프로필 공개, 메일링
 */
export async function updateProfile(
	mbId: string,
	fields: {
		mb_homepage?: string;
		mb_signature?: string;
		mb_open?: number;
		mb_mailling?: number;
	}
): Promise<{ success: boolean; error?: string }> {
	const updates: string[] = [];
	const values: (string | number)[] = [];

	if (fields.mb_homepage !== undefined) {
		// URL 형식 검증 (빈 문자열 허용)
		if (fields.mb_homepage && !/^https?:\/\/.+/.test(fields.mb_homepage)) {
			return { success: false, error: '홈페이지 URL은 http:// 또는 https://로 시작해야 합니다.' };
		}
		updates.push('mb_homepage = ?');
		values.push(fields.mb_homepage);
	}

	if (fields.mb_signature !== undefined) {
		// 서명 길이 제한 (255자)
		if (fields.mb_signature.length > 255) {
			return { success: false, error: '서명은 255자 이내로 입력해주세요.' };
		}
		updates.push('mb_signature = ?');
		values.push(fields.mb_signature);
	}

	if (fields.mb_open !== undefined) {
		updates.push('mb_open = ?');
		values.push(fields.mb_open ? 1 : 0);
	}

	if (fields.mb_mailling !== undefined) {
		updates.push('mb_mailling = ?');
		values.push(fields.mb_mailling ? 1 : 0);
	}

	if (updates.length === 0) {
		return { success: false, error: '변경할 항목이 없습니다.' };
	}

	values.push(mbId);
	await pool.query<ResultSetHeader>(
		`UPDATE g5_member SET ${updates.join(', ')} WHERE mb_id = ?`,
		values
	);

	return { success: true };
}

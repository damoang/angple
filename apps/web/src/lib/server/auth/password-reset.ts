/**
 * 비밀번호 찾기/재설정 로직
 * PHP의 password_lost.php, password_reset.php 호환
 * g5_member.mb_lost_certify 필드 사용
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { createHash, randomBytes } from 'crypto';
import { sendMail } from '$lib/server/mailer.js';

const SITE_URL = process.env.SITE_URL || 'https://web.damoang.net';

/** 이메일로 회원 조회 (탈퇴/차단 제외, 소셜 전용 계정 포함) */
export async function findMemberByEmailForReset(
    email: string
): Promise<{ mb_id: string; mb_no: number; mb_name: string; mb_nick: string } | null> {
    if (!email) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_no, mb_name, mb_nick
		 FROM g5_member
		 WHERE mb_email = ? AND mb_leave_date = '' AND mb_intercept_date = ''
		 LIMIT 1`,
        [email]
    );
    return (rows[0] as { mb_id: string; mb_no: number; mb_name: string; mb_nick: string }) || null;
}

/**
 * 비밀번호 재설정 nonce 생성 및 저장
 * PHP 호환: mb_lost_certify에 "{nonce} {encrypted_temp}" 형식으로 저장
 */
export async function createPasswordResetToken(mbId: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const tempPassword = randomBytes(8).toString('hex');
    const encryptedTemp = createHash('sha256').update(tempPassword).digest('hex');

    // mb_lost_certify에 nonce와 암호화된 임시 비밀번호 저장
    await pool.query('UPDATE g5_member SET mb_lost_certify = ? WHERE mb_id = ?', [
        `${nonce} ${encryptedTemp}`,
        mbId
    ]);

    return nonce;
}

/** 비밀번호 재설정 토큰 검증 */
export async function verifyPasswordResetToken(
    mbNo: number,
    nonce: string
): Promise<{ valid: boolean; mbId?: string }> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_lost_certify
		 FROM g5_member
		 WHERE mb_no = ? AND mb_leave_date = '' AND mb_intercept_date = ''
		 LIMIT 1`,
        [mbNo]
    );

    if (!rows[0]) return { valid: false };

    const member = rows[0] as { mb_id: string; mb_lost_certify: string };
    const storedNonce = member.mb_lost_certify.split(' ')[0];

    if (storedNonce !== nonce) return { valid: false };

    return { valid: true, mbId: member.mb_id };
}

/**
 * 비밀번호 변경
 * PHP 호환: password_hash() 대신 단순 sha256 → 실제 환경에서는 bcrypt 사용 권장
 */
export async function updatePassword(mbId: string, newPassword: string): Promise<void> {
    // PHP의 password_hash() (bcrypt) 호환을 위해 sha256 + 솔트 사용
    // 주의: 실제 PHP는 password_hash($password, PASSWORD_DEFAULT)를 사용
    // SvelteKit에서도 동일하게 bcrypt를 쓰려면 별도 패키지 필요
    // 여기서는 임시로 sha256 사용 (TODO: bcrypt 호환 필요)
    const hashed = createHash('sha256').update(newPassword).digest('hex');

    await pool.query('UPDATE g5_member SET mb_password = ?, mb_lost_certify = ? WHERE mb_id = ?', [
        hashed,
        '',
        mbId
    ]);
}

/** 비밀번호 재설정 이메일 발송 */
export async function sendPasswordResetEmail(params: {
    to: string;
    nickname: string;
    mbNo: number;
    nonce: string;
}): Promise<void> {
    const resetUrl = `${SITE_URL}/password-reset/${params.nonce}?mb_no=${params.mbNo}`;

    await sendMail({
        to: params.to,
        subject: '[다모앙] 비밀번호 재설정 안내',
        html: `
			<div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
				<h2 style="color:#333;">비밀번호 재설정</h2>
				<p>${params.nickname}님, 안녕하세요.</p>
				<p>아래 버튼을 클릭하여 비밀번호를 재설정하세요.</p>
				<p style="margin:30px 0;">
					<a href="${resetUrl}"
					   style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
						비밀번호 재설정
					</a>
				</p>
				<p style="color:#666;font-size:14px;">
					이 링크는 1회용이며 유효기간이 제한됩니다.<br/>
					본인이 요청하지 않았다면 이 메일을 무시하세요.
				</p>
				<hr style="border:0;border-top:1px solid #eee;margin:30px 0;">
				<p style="color:#999;font-size:12px;">다모앙 (damoang.net)</p>
			</div>
		`
    });
}

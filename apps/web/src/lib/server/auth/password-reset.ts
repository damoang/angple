/**
 * 비밀번호 찾기/재설정 로직
 * PHP의 password_lost.php, password_reset.php 호환
 * g5_member.mb_lost_certify 필드 사용
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { sendMail } from '$lib/server/mailer.js';

/** 토큰 유효기간: 24시간 */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

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
    const timestamp = Date.now().toString(36); // 타임스탬프 (만료 체크용)

    // mb_lost_certify에 "nonce timestamp" 형식으로 저장
    await pool.query('UPDATE g5_member SET mb_lost_certify = ? WHERE mb_id = ?', [
        `${nonce} ${timestamp}`,
        mbId
    ]);

    return nonce;
}

/** 비밀번호 재설정 토큰 검증 (24시간 만료) */
export async function verifyPasswordResetToken(
    mbNo: number,
    nonce: string
): Promise<{ valid: boolean; mbId?: string; error?: string }> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_lost_certify
		 FROM g5_member
		 WHERE mb_no = ? AND mb_leave_date = '' AND mb_intercept_date = ''
		 LIMIT 1`,
        [mbNo]
    );

    if (!rows[0]) return { valid: false };

    const member = rows[0] as { mb_id: string; mb_lost_certify: string };
    const parts = member.mb_lost_certify.split(' ');
    const storedNonce = parts[0];
    const storedTimestamp = parts[1];

    if (storedNonce !== nonce) return { valid: false };

    // 만료 체크 (24시간)
    if (storedTimestamp) {
        const createdAt = parseInt(storedTimestamp, 36);
        if (Date.now() - createdAt > TOKEN_EXPIRY_MS) {
            return {
                valid: false,
                error: '만료된 링크입니다. 비밀번호 재설정을 다시 요청해주세요.'
            };
        }
    }

    return { valid: true, mbId: member.mb_id };
}

/**
 * 비밀번호 변경
 * PHP password_hash($password, PASSWORD_DEFAULT) 호환 (bcrypt)
 */
export async function updatePassword(mbId: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);

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

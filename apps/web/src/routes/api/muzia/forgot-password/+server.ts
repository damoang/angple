import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import crypto from 'crypto';
import { createTransport } from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'muzia-smtp';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@muzia.net';
const SITE_URL = 'https://muzia.net';
const TOKEN_EXPIRY_MIN = 30;

/** POST /api/muzia/forgot-password — 비밀번호 재설정 요청 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { email } = await request.json() as { email: string };

        if (!email?.trim()) {
            return json({ success: false, error: '이메일을 입력해주세요' }, { status: 400 });
        }

        const conn = await getConnection();

        // 이메일로 회원 찾기
        const [rows] = await conn.query(
            'SELECT mb_id, mb_email FROM g5_member WHERE mb_email = ?',
            [email.trim()]
        ) as any;

        // 보안: 회원 존재 여부 노출하지 않음 (항상 같은 응답)
        if (rows.length === 0) {
            conn.release();
            return json({ success: true, message: '등록된 이메일이라면 재설정 링크가 발송됩니다.' });
        }

        const member = rows[0];

        // 기존 미사용 토큰 삭제
        await conn.query(
            'DELETE FROM muzia_password_resets WHERE mb_id = ? AND used = 0',
            [member.mb_id]
        );

        // 토큰 생성
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MIN * 60 * 1000);

        await conn.query(
            'INSERT INTO muzia_password_resets (mb_id, token, expires_at) VALUES (?, ?, ?)',
            [member.mb_id, token, expiresAt]
        );

        conn.release();

        // 이메일 발송
        const resetUrl = `${SITE_URL}/reset-password?token=${token}`;

        const transporter = createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: false,
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: `"뮤지아(Muzia)" <${SMTP_FROM}>`,
            to: member.mb_email,
            subject: '[뮤지아] 비밀번호 재설정',
            html: `
                <div style="max-width:480px;margin:0 auto;font-family:-apple-system,sans-serif;">
                    <div style="padding:32px;background:#f9fafb;border-radius:12px;">
                        <h2 style="margin:0 0 16px;font-size:20px;">비밀번호 재설정</h2>
                        <p style="color:#666;font-size:14px;line-height:1.6;">
                            아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.<br>
                            이 링크는 ${TOKEN_EXPIRY_MIN}분간 유효합니다.
                        </p>
                        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                            비밀번호 재설정
                        </a>
                        <p style="color:#999;font-size:12px;">
                            이 요청을 하지 않으셨다면 이 이메일을 무시해주세요.<br>
                            링크: ${resetUrl}
                        </p>
                    </div>
                    <p style="text-align:center;color:#999;font-size:11px;margin-top:16px;">
                        뮤지아(Muzia) · muzia.net · Since 2002
                    </p>
                </div>
            `
        });

        return json({ success: true, message: '등록된 이메일이라면 재설정 링크가 발송됩니다.' });
    } catch (error) {
        console.error('[ForgotPassword] error:', error);
        return json({ success: true, message: '등록된 이메일이라면 재설정 링크가 발송됩니다.' });
    }
};

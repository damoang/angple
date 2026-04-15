import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import crypto from 'crypto';

/** POST /api/muzia/forgot-password — 비밀번호 재설정 (임시 비밀번호 발급) */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { email, name } = await request.json() as { email: string; name: string };

        if (!email?.trim() || !name?.trim()) {
            return json({ success: false, error: '이메일과 이름을 입력해주세요' }, { status: 400 });
        }

        const conn = await getConnection();

        // 이메일 + 이름으로 회원 찾기
        const [rows] = await conn.query(
            'SELECT mb_id, mb_email, mb_name, mb_nick FROM g5_member WHERE mb_email = ? AND (mb_name = ? OR mb_nick = ?)',
            [email.trim(), name.trim(), name.trim()]
        ) as any;

        if (rows.length === 0) {
            return json({ success: false, error: '일치하는 회원 정보를 찾을 수 없습니다' }, { status: 404 });
        }

        const member = rows[0];

        // 임시 비밀번호 생성 (8자리 영문+숫자)
        const tempPassword = crypto.randomBytes(4).toString('hex'); // 8자리 hex

        // PBKDF2-SHA256 해시 생성 (gnuboard 호환)
        const salt = crypto.randomBytes(24).toString('base64');
        const iterations = 12000;
        const hash = crypto.pbkdf2Sync(tempPassword, salt, iterations, 24, 'sha256').toString('base64');
        const hashedPassword = `sha256:${iterations}:${salt}:${hash}`;

        // DB 업데이트
        await conn.query(
            'UPDATE g5_member SET mb_password = ? WHERE mb_id = ?',
            [hashedPassword, member.mb_id]
        );

        return json({
            success: true,
            data: {
                mb_id: member.mb_id,
                temp_password: tempPassword,
                message: '임시 비밀번호가 발급되었습니다. 로그인 후 비밀번호를 변경해주세요.'
            }
        });
    } catch (error) {
        console.error('[ForgotPassword] error:', error);
        return json({ success: false, error: '비밀번호 재설정 실패' }, { status: 500 });
    }
};

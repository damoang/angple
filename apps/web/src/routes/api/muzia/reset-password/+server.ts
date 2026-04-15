import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import crypto from 'crypto';

/** POST /api/muzia/reset-password — 토큰 검증 + 비밀번호 변경 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { token, password } = await request.json() as { token: string; password: string };

        if (!token || !password?.trim()) {
            return json({ success: false, error: '토큰과 비밀번호를 입력해주세요' }, { status: 400 });
        }

        if (password.trim().length < 6) {
            return json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 });
        }

        const conn = await getConnection();

        // 토큰 검증
        const [rows] = await conn.query(
            'SELECT id, mb_id, expires_at, used FROM muzia_password_resets WHERE token = ?',
            [token]
        ) as any;

        if (rows.length === 0) {
            conn.release();
            return json({ success: false, error: '유효하지 않은 링크입니다' }, { status: 400 });
        }

        const reset = rows[0];

        if (reset.used) {
            conn.release();
            return json({ success: false, error: '이미 사용된 링크입니다' }, { status: 400 });
        }

        if (new Date(reset.expires_at) < new Date()) {
            conn.release();
            return json({ success: false, error: '링크가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 });
        }

        // PBKDF2-SHA256 해시 생성 (gnuboard 호환)
        const salt = crypto.randomBytes(24).toString('base64');
        const iterations = 12000;
        const hash = crypto.pbkdf2Sync(password.trim(), salt, iterations, 24, 'sha256').toString('base64');
        const hashedPassword = `sha256:${iterations}:${salt}:${hash}`;

        // 비밀번호 업데이트
        await conn.query(
            'UPDATE g5_member SET mb_password = ? WHERE mb_id = ?',
            [hashedPassword, reset.mb_id]
        );

        // 토큰 사용 처리
        await conn.query(
            'UPDATE muzia_password_resets SET used = 1 WHERE id = ?',
            [reset.id]
        );

        conn.release();

        return json({ success: true, message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
    } catch (error) {
        console.error('[ResetPassword] error:', error);
        return json({ success: false, error: '비밀번호 변경 실패' }, { status: 500 });
    }
};

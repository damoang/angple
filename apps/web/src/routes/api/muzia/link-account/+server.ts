import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';
import crypto from 'crypto';

/** POST /api/muzia/link-account — OAuth 계정을 기존 계정에 연결 */
export const POST: RequestHandler = async ({ request }) => {
    // 현재 로그인된 OAuth 사용자
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    const currentMbId = getMbId(user);

    // oauth_ 접두사가 아니면 이미 일반 계정
    if (!currentMbId.startsWith('oauth_')) {
        return json({ success: false, error: '이미 일반 계정으로 로그인되어 있습니다' }, { status: 400 });
    }

    try {
        const { mb_id, password } = await request.json() as { mb_id: string; password: string };

        if (!mb_id?.trim() || !password?.trim()) {
            return json({ success: false, error: '아이디와 비밀번호를 입력해주세요' }, { status: 400 });
        }

        const conn = await getConnection();

        // 기존 계정 찾기
        const [rows] = await conn.query(
            'SELECT mb_id, mb_password, mb_nick FROM g5_member WHERE mb_id = ?',
            [mb_id.trim()]
        ) as any;

        if (rows.length === 0) {
            return json({ success: false, error: '존재하지 않는 아이디입니다' }, { status: 404 });
        }

        const member = rows[0];

        // 비밀번호 확인 (PBKDF2-SHA256)
        const parts = member.mb_password.split(':');
        if (parts.length !== 4 || parts[0] !== 'sha256') {
            return json({ success: false, error: '비밀번호 형식 오류' }, { status: 500 });
        }

        const [, iterStr, salt, storedHash] = parts;
        const iterations = parseInt(iterStr);
        const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 24, 'sha256').toString('base64');

        if (computedHash !== storedHash) {
            return json({ success: false, error: '비밀번호가 일치하지 않습니다' }, { status: 401 });
        }

        // oauth_accounts 테이블에서 user_id를 기존 mb_id로 변경
        await conn.query(
            'UPDATE oauth_accounts SET user_id = ? WHERE user_id = ?',
            [member.mb_id, currentMbId]
        );

        // OAuth로 생성된 g5_member 레코드 삭제 (기존 계정으로 통합)
        await conn.query(
            'DELETE FROM g5_member WHERE mb_id = ?',
            [currentMbId]
        );

        return json({
            success: true,
            data: {
                mb_id: member.mb_id,
                nickname: member.mb_nick,
                message: '계정이 연결되었습니다. 다시 로그인해주세요.'
            }
        });
    } catch (error) {
        console.error('[LinkAccount] error:', error);
        return json({ success: false, error: '계정 연결 실패' }, { status: 500 });
    }
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** POST /api/muzia/forgot-password — 비밀번호 재설정 (이메일 발송 전까지 비활성화) */
export const POST: RequestHandler = async () => {
    return json({
        success: false,
        error: '비밀번호 재설정은 help@muzia.net으로 문의해주세요.'
    }, { status: 503 });
};

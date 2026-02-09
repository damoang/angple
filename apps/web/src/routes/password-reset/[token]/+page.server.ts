/**
 * 비밀번호 재설정 - 새 비밀번호 입력 페이지
 */
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, error as httpError } from '@sveltejs/kit';
import { verifyPasswordResetToken, updatePassword } from '$lib/server/auth/password-reset.js';

export const load: PageServerLoad = async ({ params, url }) => {
    const nonce = params.token;
    const mbNo = Number(url.searchParams.get('mb_no'));

    if (!nonce || !mbNo) {
        throw httpError(400, '잘못된 비밀번호 재설정 링크입니다.');
    }

    // 토큰 검증
    const result = await verifyPasswordResetToken(mbNo, nonce);
    if (!result.valid) {
        throw httpError(
            400,
            '만료되었거나 유효하지 않은 링크입니다. 다시 비밀번호 찾기를 시도해주세요.'
        );
    }

    return {
        nonce,
        mbNo
    };
};

export const actions: Actions = {
    default: async ({ request, params, url }) => {
        const formData = await request.formData();
        const password = (formData.get('password') as string) || '';
        const passwordConfirm = (formData.get('password_confirm') as string) || '';
        const nonce = params.token;
        const mbNo = Number(url.searchParams.get('mb_no'));

        // 비밀번호 검증
        if (!password || password.length < 6) {
            return fail(400, { error: '비밀번호는 6자 이상 입력해주세요.' });
        }

        if (password !== passwordConfirm) {
            return fail(400, { error: '비밀번호가 일치하지 않습니다.' });
        }

        // 토큰 재검증
        const result = await verifyPasswordResetToken(mbNo, nonce);
        if (!result.valid || !result.mbId) {
            return fail(400, { error: '만료되었거나 유효하지 않은 링크입니다.' });
        }

        try {
            await updatePassword(result.mbId, password);
            redirect(302, '/login?message=password_reset_success');
        } catch (err) {
            if (err && typeof err === 'object' && 'status' in err) {
                throw err;
            }
            console.error('[Password Reset] 비밀번호 변경 실패:', err);
            return fail(500, { error: '비밀번호 변경 중 오류가 발생했습니다.' });
        }
    }
};

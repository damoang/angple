/**
 * 회원 탈퇴 페이지 서버
 */
import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/auth/jwt.js';
import { processMemberLeave } from '$lib/server/auth/member-leave.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const refreshToken = cookies.get('refresh_token');
	if (!refreshToken) {
		redirect(302, '/login?redirect=/member/leave');
	}

	const payload = await verifyToken(refreshToken);
	if (!payload?.sub) {
		redirect(302, '/login?redirect=/member/leave');
	}

	return { mbId: payload.sub };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const refreshToken = cookies.get('refresh_token');
		if (!refreshToken) return fail(401, { error: '로그인이 필요합니다.' });

		const payload = await verifyToken(refreshToken);
		if (!payload?.sub) return fail(401, { error: '로그인이 필요합니다.' });

		const formData = await request.formData();
		const confirmText = (formData.get('confirmText') as string)?.trim();

		if (confirmText !== '탈퇴합니다') {
			return fail(400, { error: '"탈퇴합니다"를 정확히 입력해주세요.' });
		}

		const result = await processMemberLeave(payload.sub);
		if (!result.success) {
			return fail(400, { error: result.error });
		}

		// 쿠키 삭제
		cookies.delete('refresh_token', { path: '/' });
		cookies.delete('access_token', { path: '/' });

		redirect(302, '/?left=1');
	}
};

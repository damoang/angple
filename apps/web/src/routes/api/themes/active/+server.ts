import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveTheme, setActiveTheme } from '$lib/server/settings';

/**
 * GET /api/themes/active
 * 현재 활성화된 테마 ID 조회
 */
export const GET: RequestHandler = async () => {
	try {
		const activeTheme = await getActiveTheme();
		return json({ activeTheme });
	} catch (error) {
		console.error('❌ 활성 테마 조회 실패:', error);
		return json({ error: '활성 테마 조회 실패' }, { status: 500 });
	}
};

/**
 * PUT /api/themes/active
 * 테마 활성화
 */
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const { themeId } = await request.json();

		if (!themeId || typeof themeId !== 'string') {
			return json({ error: 'themeId가 필요합니다' }, { status: 400 });
		}

		await setActiveTheme(themeId);

		return json({ success: true, activeTheme: themeId });
	} catch (error) {
		console.error('❌ 테마 활성화 실패:', error);
		return json({ error: '테마 활성화 실패' }, { status: 500 });
	}
};

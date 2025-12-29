/**
 * 활성 테마 API
 * - GET: 현재 활성화된 테마 조회
 * - PUT: 테마 활성화
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSettings, setActiveTheme as saveActiveTheme } from '$lib/server/settings';

/**
 * GET /api/themes/active
 * 현재 활성화된 테마 정보 반환
 */
export const GET: RequestHandler = async () => {
    try {
        const settings = await readSettings();

        if (!settings.activeTheme) {
            return json({ error: '활성화된 테마가 없습니다.' }, { status: 404 });
        }

        return json(settings);
    } catch (error) {
        console.error('❌ 활성 테마 조회 실패:', error);
        return json({ error: '서버 오류' }, { status: 500 });
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
            return json({ error: 'themeId가 필요합니다.' }, { status: 400 });
        }

        await saveActiveTheme(themeId);

        return json({ success: true, themeId });
    } catch (error) {
        console.error('❌ 테마 활성화 실패:', error);
        return json({ error: '서버 오류' }, { status: 500 });
    }
};

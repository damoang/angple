import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getThemeSettings, setThemeSettings } from '$lib/server/settings';

/**
 * GET /api/themes/{id}/settings
 * 특정 테마의 설정값 조회
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;
        const settings = await getThemeSettings(id);
        return json({ themeId: id, settings });
    } catch (error) {
        console.error('❌ 테마 설정 조회 실패:', { themeId: params.id, error });
        return json({ error: '테마 설정 조회 실패' }, { status: 500 });
    }
};

/**
 * PUT /api/themes/{id}/settings
 * 특정 테마의 설정값 저장
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const { id } = params;
        const { settings } = await request.json();

        if (!settings || typeof settings !== 'object') {
            return json({ error: 'settings 객체가 필요합니다' }, { status: 400 });
        }

        await setThemeSettings(id, settings);

        return json({ success: true, themeId: id, settings });
    } catch (error) {
        console.error('❌ 테마 설정 저장 실패:', { themeId: params.id, error });
        return json({ error: '테마 설정 저장 실패' }, { status: 500 });
    }
};

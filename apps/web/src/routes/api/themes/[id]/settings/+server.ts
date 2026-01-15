import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getThemeSettings, setThemeSettings } from '$lib/server/settings';
import { sanitizePath } from '$lib/server/path-utils';

/**
 * GET /api/themes/{id}/settings
 * 특정 테마의 설정값 조회
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        // Path Traversal 방지
        const sanitizedId = sanitizePath(id);

        const settings = await getThemeSettings(sanitizedId);
        return json({ themeId: sanitizedId, settings });
    } catch (error) {
        console.error('❌ 테마 설정 조회 실패:', { themeId: params.id, error });

        // sanitizePath 에러는 400으로 처리
        if (error instanceof Error && error.message.includes('Invalid path')) {
            return json({ error: error.message }, { status: 400 });
        }

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

        // Path Traversal 방지
        const sanitizedId = sanitizePath(id);

        await setThemeSettings(sanitizedId, settings);

        return json({ success: true, themeId: sanitizedId, settings });
    } catch (error) {
        console.error('❌ 테마 설정 저장 실패:', { themeId: params.id, error });

        // sanitizePath 에러는 400으로 처리
        if (error instanceof Error && error.message.includes('Invalid path')) {
            return json({ error: error.message }, { status: 400 });
        }

        return json({ error: '테마 설정 저장 실패' }, { status: 500 });
    }
};

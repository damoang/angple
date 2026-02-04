import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { siteSettingsProvider } from '$lib/server/settings/site-settings-provider.js';

/** 설정 전체 조회 */
export const GET: RequestHandler = async () => {
    try {
        const settings = await siteSettingsProvider.load();
        return json(settings);
    } catch (error) {
        console.error('설정 로드 실패:', error);
        return json({ error: '설정을 불러올 수 없습니다.' }, { status: 500 });
    }
};

/** 설정 전체 저장 */
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const data = await request.json();
        await siteSettingsProvider.save(data);
        return json({ success: true });
    } catch (error) {
        console.error('설정 저장 실패:', error);
        return json({ error: '설정을 저장할 수 없습니다.' }, { status: 500 });
    }
};

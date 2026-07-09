import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getContentVersion, getSiteTitle, replaceContentVariables } from '$lib/server/content.js';

export const load: PageServerLoad = async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
        error(404, { message: '버전을 찾을 수 없습니다.' });
    }

    const [version, siteTitle] = await Promise.all([getContentVersion(id), getSiteTitle()]);
    if (!version) {
        error(404, { message: '버전을 찾을 수 없습니다.' });
    }

    return {
        version: {
            id: version.id,
            version_no: version.version_no,
            effective_date: version.effective_date,
            status: version.status,
            title: version.title,
            content: replaceContentVariables(version.content, siteTitle)
        }
    };
};

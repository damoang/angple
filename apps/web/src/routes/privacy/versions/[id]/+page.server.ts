import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
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

    // 시행 예정(scheduled) 버전은 preview 로 일관 노출 (history 도 preview 로만 링크).
    if (version.status === 'scheduled') {
        redirect(302, `/privacy/preview/${id}`);
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

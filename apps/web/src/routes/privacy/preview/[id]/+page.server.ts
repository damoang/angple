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
    // 예고(scheduled) 버전만 미리보기 대상. 이미 시행된 버전은 정식 열람으로 이동.
    if (version.status !== 'scheduled') {
        redirect(302, `/privacy/versions/${id}`);
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

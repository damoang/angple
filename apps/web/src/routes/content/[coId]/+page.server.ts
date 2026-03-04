import type { PageServerLoad } from './$types';
import { getContent, getSiteTitle, replaceContentVariables } from '$lib/server/content.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
    const coId = params.coId;

    // Validate co_id format (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(coId)) {
        error(400, '유효하지 않은 페이지 ID');
    }

    const [content, siteTitle] = await Promise.all([getContent(coId), getSiteTitle()]);

    if (!content) {
        error(404, '페이지를 찾을 수 없습니다');
    }

    return {
        title: content.co_subject || coId,
        content: replaceContentVariables(content.co_content, siteTitle),
        coHtml: content.co_html ?? 1,
        seoTitle: ''
    };
};

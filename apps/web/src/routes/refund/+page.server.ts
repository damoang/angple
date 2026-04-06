import type { PageServerLoad } from './$types';
import { getContent, getSiteTitle, replaceContentVariables } from '$lib/server/content.js';

export const load: PageServerLoad = async () => {
    const [content, siteTitle] = await Promise.all([getContent('refund'), getSiteTitle()]);

    return {
        title: content?.co_subject || '환불 및 교환 정책',
        content: content ? replaceContentVariables(content.co_content, siteTitle) : '',
        coHtml: content?.co_html ?? 1
    };
};

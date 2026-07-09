import type { PageServerLoad } from './$types';
import {
    getContent,
    getSiteTitle,
    replaceContentVariables,
    promoteDuePolicyVersions
} from '$lib/server/content.js';

export const load: PageServerLoad = async () => {
    // 시행일이 도래한 예약 버전을 자동 승격(지연 승격). 실패해도 읽기 흐름은 유지됨.
    await promoteDuePolicyVersions('privacy');

    const [content, siteTitle] = await Promise.all([getContent('privacy'), getSiteTitle()]);

    return {
        title: content?.co_subject || '개인정보처리방침',
        content: content ? replaceContentVariables(content.co_content, siteTitle) : '',
        coHtml: content?.co_html ?? 1
    };
};

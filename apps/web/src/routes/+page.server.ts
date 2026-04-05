import type { PageServerLoad } from './$types';
import { getWikiPage, getRecentPages } from '$lib/server/wiki';

export const load: PageServerLoad = async () => {
    const [mainPage, recentPages] = await Promise.all([getWikiPage('/대문'), getRecentPages(10)]);

    return {
        mainPage,
        recentPages
    };
};

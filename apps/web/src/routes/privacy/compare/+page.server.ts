import type { PageServerLoad } from './$types';
import {
    getContentVersion,
    getContentVersions,
    getSiteTitle,
    replaceContentVariables,
    type ContentVersion
} from '$lib/server/content.js';

interface CompareSide {
    id: number;
    version_no: number;
    effective_date: string;
    status: string;
    title: string;
    content: string;
}

function toSide(version: ContentVersion | null, siteTitle: string): CompareSide | null {
    if (!version) return null;
    return {
        id: version.id,
        version_no: version.version_no,
        effective_date: version.effective_date,
        status: version.status,
        title: version.title,
        content: replaceContentVariables(version.content, siteTitle)
    };
}

export const load: PageServerLoad = async ({ url }) => {
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const siteTitle = await getSiteTitle();

    let fromVer: ContentVersion | null = null;
    let toVer: ContentVersion | null = null;

    if (fromParam && toParam) {
        [fromVer, toVer] = await Promise.all([
            getContentVersion(Number(fromParam)),
            getContentVersion(Number(toParam))
        ]);
    } else {
        // 기본값: to = 현재 active, from = 직전 archived(가장 최근 보관본)
        const versions = await getContentVersions('privacy'); // effective_date DESC
        const active = versions.find((v) => v.status === 'active');
        const latestArchived = versions.find((v) => v.status === 'archived');
        [toVer, fromVer] = await Promise.all([
            active ? getContentVersion(active.id) : Promise.resolve(null),
            latestArchived ? getContentVersion(latestArchived.id) : Promise.resolve(null)
        ]);
    }

    return {
        from: toSide(fromVer, siteTitle),
        to: toSide(toVer, siteTitle)
    };
};

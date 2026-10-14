/** Public wiki URLs; shared by routing, links and the editor. */
export function wikiHref(path: string): string {
    return '/' + path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
}
const specialAliases: Record<string, string> = {
    최근바뀜: 'RecentChanges',
    최근변경: 'RecentChanges',
    모든문서: 'AllPages',
    분류: 'Categories',
    분류목록: 'Categories',
    검색: 'Search',
    새문서: 'NewPage',
    임의문서: 'Random',
    태그: 'Tags'
};
export function canonicalWikiPath(path: string): string {
    let decoded: string;
    try {
        decoded = decodeURIComponent(path);
    } catch {
        return path;
    }
    decoded = decoded.replace(/^\/(?:wiki|w)(?=\/|$)/, '') || '/대문';
    decoded = decoded.replace(
        /^\/특수:([^/]+)/,
        (_, name: string) => '/Special:' + (specialAliases[name] || name)
    );
    return wikiHref(legacyWikiPath(decoded));
}
export function validateWikiPath(path: string): string | null {
    const p = '/' + path.trim().replace(/^\/+|\/+$/g, '');
    if (
        p.length < 2 ||
        p.length > 500 ||
        /[?#\\<>\x00-\x1f]/.test(p) ||
        p.includes('//') ||
        p.split('/').some((s) => s === '.' || s === '..')
    )
        return null;
    if (
        /^\/(?:Special:|특수:|api(?:\/|$)|admin(?:\/|$)|auth(?:\/|$)|wiki-auth(?:\/|$)|login$|search$|wiki(?:\/|$)|w(?:\/|$)|_app(?:\/|$)|sitemap|robots\.txt)/i.test(
            p
        ) ||
        /\/(edit|history)$/.test(p)
    )
        return null;
    return p;
}

/** Explicit, verified migration aliases; do not merge similarly named articles. */
const legacyPaths: Record<string, string> = {
    '/_wikiang_editing-guidelines': '/wikiang/editing-guidelines',
    '/_ko_wikiang_faq': '/wikiang/faq',
    '/ko/wikiang/faq': '/wikiang/faq',
    '/_ko_정치인_이재명': '/위키앙_문서/정치인/이재명',
    '/ko/정치인/이재명': '/위키앙_문서/정치인/이재명',
    '/_ko_대한민국-정부_이재명*정부': '/위키앙_문서/대한민국_정부/이재명_정부',
    '/ko/대한민국-정부/이재명_정부': '/위키앙_문서/대한민국_정부/이재명_정부',
    '/_ko_대한민국-정부_이재명*정부_2025년06월':
        '/위키앙_문서/대한민국_정부/이재명_정부/2025년06월',
    '/ko/대한민국-정부/이재명_정부/2025년06월': '/위키앙_문서/대한민국_정부/이재명_정부/2025년06월',
    '/대통령실_일지': '/이재명_정부/대통령실_일지',
    '/국무조정실_일지': '/이재명_정부/국무조정실_일지'
};
export function legacyWikiPath(path: string): string {
    return legacyPaths[path] || path;
}

export function decodeWikiPath(path: string): string {
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}

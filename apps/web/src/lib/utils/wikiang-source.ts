export function wikiSourceTitle(href: string): string | null {
    try {
        const url = new URL(href);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
            return null;
        const namu = url.hostname === 'namu.wiki' || url.hostname.endsWith('.namu.wiki');
        const wikipedia = /^[a-z][a-z0-9-]*(?:\.m)?\.wikipedia\.org$/.test(url.hostname);
        const prefix = namu ? '/w/' : wikipedia ? '/wiki/' : null;
        if (!prefix || !url.pathname.startsWith(prefix)) return null;
        let title = decodeURIComponent(url.pathname.slice(prefix.length)).trim();
        if (wikipedia) title = title.replace(/_/g, ' ');
        return title && title.length <= 255 ? title : null;
    } catch {
        return null;
    }
}

export function wikiangDocumentUrl(path: string): string | null {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x1f]/.test(path)) return null;
    try {
        const url = new URL(path, 'https://wikiang.org');
        return url.origin === 'https://wikiang.org' ? url.href : null;
    } catch {
        return null;
    }
}

export interface WikiangLookup {
    checked: string[];
    pages: { title: string; path: string }[];
}

/** 부분 응답이나 잘못된 경로를 문서 부재로 해석하지 않는다. */
export function isWikiangLookup(data: unknown, titles: string[]): data is WikiangLookup {
    if (!data || typeof data !== 'object' || !('checked' in data) || !('pages' in data))
        return false;
    const { checked, pages } = data;
    if (!Array.isArray(checked) || !Array.isArray(pages) || pages.length > 20) return false;
    if (checked.length !== titles.length || !titles.every((title) => checked.includes(title)))
        return false;
    const seen = new Set<string>();
    return pages.every((page) => {
        if (
            !page ||
            typeof page !== 'object' ||
            typeof page.title !== 'string' ||
            !titles.includes(page.title) ||
            seen.has(page.title) ||
            typeof page.path !== 'string' ||
            !wikiangDocumentUrl(page.path)
        )
            return false;
        seen.add(page.title);
        return true;
    });
}

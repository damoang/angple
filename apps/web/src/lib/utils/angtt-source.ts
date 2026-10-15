/** 외부 요청 없이 TMDB 작품 URL의 식별자만 읽는다. */
export function tmdbSourceKey(raw: string): string | null {
    try {
        const url = new URL(raw);
        if (
            !['https:', 'http:'].includes(url.protocol) ||
            !['themoviedb.org', 'www.themoviedb.org'].includes(url.hostname) ||
            url.username ||
            url.password ||
            url.port
        ) {
            return null;
        }
        const match = url.pathname.match(/^\/(movie|tv)\/([1-9]\d*)(?:-[^/]*)?(?:\/|$)/);
        if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
        return `${match[1]}:${match[2]}`;
    } catch {
        return null;
    }
}

/** 입력 크기와 후보 수를 제한한다. 여러 작품이 있으면 임의로 하나를 고르지 않는다. */
export function findTmdbSources(...texts: string[]): string[] {
    const sources = new Map<string, string>();
    for (const text of texts) {
        for (const match of text.slice(0, 100_000).matchAll(/https?:\/\/[^\s<>"']+/g)) {
            const raw = match[0].replace(/[)\]},.;!?]+$/, '').replace(/&amp;/g, '&');
            const key = tmdbSourceKey(raw);
            if (!key) continue;
            sources.set(key, raw);
            if (sources.size === 2) return [...sources.values()];
        }
    }
    return [...sources.values()];
}

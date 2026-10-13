import type { RequestHandler } from './$types';
import { getAllPages } from '$lib/server/wiki';
import { wikiHref } from '$lib/wiki/paths';
export const GET: RequestHandler = async () => {
    const entries: string[] = [];
    let offset = 0;
    while (true) {
        const result = await getAllPages(offset, 100, 'title');
        for (const page of result.items) entries.push(`<url><loc>https://wikiang.org${wikiHref(page.path)}</loc><lastmod>${new Date(page.updated_at).toISOString().split('T')[0]}</lastmod></url>`);
        if (!result.hasMore) break;
        offset += result.limit;
    }
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};

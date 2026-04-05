import type { RequestHandler } from './$types';
import { getAllPages } from '$lib/server/wiki';

/**
 * 위키앙 전용 Sitemap 생성 엔드포인트
 * 모든 위키 문서를 포함
 */
export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');

    let pagesXml = '';

    try {
        const pages = await getAllPages(0, 10000, 'updated');

        pagesXml = pages.items
            .map(
                (page) => `  <url>
    <loc>${siteUrl}/wiki${encodeURI(page.path)}</loc>
    <lastmod>${new Date(page.updated_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
            )
            .join('\n');
    } catch (err) {
        console.error('[Sitemap Wiki] 위키 페이지 조회 실패:', err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/wiki</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${pagesXml}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};

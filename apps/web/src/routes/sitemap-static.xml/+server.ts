import type { RequestHandler } from './$types';

/**
 * 정적 페이지 Sitemap
 */
export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');
    const now = new Date().toISOString().split('T')[0];

    // 정적 페이지 목록
    const staticPages = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/search', priority: '0.5', changefreq: 'weekly' },
        { loc: '/terms', priority: '0.2', changefreq: 'yearly' },
        { loc: '/privacy', priority: '0.2', changefreq: 'yearly' },
        { loc: '/policy', priority: '0.2', changefreq: 'yearly' },
        { loc: '/level', priority: '0.2', changefreq: 'yearly' },
        { loc: '/guide', priority: '0.3', changefreq: 'monthly' },
        { loc: '/faq', priority: '0.3', changefreq: 'monthly' },
        { loc: '/advertising', priority: '0.2', changefreq: 'monthly' }
    ];

    const urls = staticPages.map(
        (page) => `  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400' // 24시간 캐시
        }
    });
};

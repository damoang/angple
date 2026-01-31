import type { RequestHandler } from './$types';

/**
 * 동적 Sitemap 생성 엔드포인트
 *
 * TODO: 실제 게시판/게시글 데이터를 API에서 가져와 동적으로 생성
 * 현재는 정적 페이지 목록만 포함합니다.
 */
export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin;

    const staticPages = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/search', priority: '0.5', changefreq: 'weekly' },
        { loc: '/login', priority: '0.3', changefreq: 'monthly' }
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
    .map(
        (page) => `  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'max-age=3600'
        }
    });
};

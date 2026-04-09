import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const hostname = url.hostname;
    const site = `https://${hostname}`;
    const pages = ['/', '/login', '/register', '/qna', '/forum', '/music', '/sibelius', '/notice', '/attendance', '/privacy', '/terms'];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${site}${p}</loc>
    <changefreq>${p === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${p === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml.trim(), {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'max-age=3600'
        }
    });
};

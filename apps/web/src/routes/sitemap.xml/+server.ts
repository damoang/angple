import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const hostname = url.hostname;
    const site = `https://${hostname}`;
    const now = new Date().toISOString().slice(0, 10);

    // 정적 페이지
    const staticPages = [
        { loc: '/', changefreq: 'daily', priority: '1.0' },
        { loc: '/qna', changefreq: 'daily', priority: '0.9' },
        { loc: '/forum', changefreq: 'daily', priority: '0.9' },
        { loc: '/music', changefreq: 'daily', priority: '0.8' },
        { loc: '/sibelius', changefreq: 'weekly', priority: '0.8' },
        { loc: '/dorico', changefreq: 'weekly', priority: '0.8' },
        { loc: '/violin', changefreq: 'weekly', priority: '0.8' },
        { loc: '/tip', changefreq: 'weekly', priority: '0.7' },
        { loc: '/notice', changefreq: 'weekly', priority: '0.7' },
        { loc: '/hello', changefreq: 'weekly', priority: '0.6' },
        { loc: '/attendance', changefreq: 'daily', priority: '0.6' },
        { loc: '/company', changefreq: 'monthly', priority: '0.5' },
        { loc: '/forgot-password', changefreq: 'monthly', priority: '0.3' },
        { loc: '/login', changefreq: 'monthly', priority: '0.3' },
        { loc: '/privacy', changefreq: 'monthly', priority: '0.3' },
        { loc: '/terms', changefreq: 'monthly', priority: '0.3' },
    ];

    // 동적 게시글 (DB에서 최근 게시글 조회)
    let dynamicUrls: { loc: string; lastmod: string; priority: string }[] = [];

    if (hostname === 'muzia.net' || hostname === 'muzia.io') {
        try {
            // muzia DB에서 최근 게시글 가져오기
            const mysql = await import('mysql2/promise');
            const conn = await mysql.createConnection({
                host: process.env.ATTENDANCE_DB_HOST || 'mysql',
                port: parseInt(process.env.ATTENDANCE_DB_PORT || '3306'),
                user: process.env.ATTENDANCE_DB_USER || 'muzia_api',
                password: process.env.ATTENDANCE_DB_PASSWORD || '',
                database: process.env.ATTENDANCE_DB_NAME || 'newcomposer',
            });

            const boards = ['qna', 'forum', 'music', 'sibelius', 'dorico', 'violin', 'tip', 'notice', 'hello'];
            for (const board of boards) {
                try {
                    const [rows] = await conn.query(
                        `SELECT wr_id, wr_datetime FROM g5_write_${board} WHERE wr_is_comment = 0 AND wr_id = wr_parent ORDER BY wr_datetime DESC LIMIT 50`
                    ) as any;
                    for (const row of rows) {
                        dynamicUrls.push({
                            loc: `/${board}/${row.wr_id}`,
                            lastmod: new Date(row.wr_datetime).toISOString().slice(0, 10),
                            priority: '0.6'
                        });
                    }
                } catch {}
            }
            await conn.end();
        } catch (e) {
            console.error('[Sitemap] DB error:', e);
        }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(p => `  <url>
    <loc>${site}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
${dynamicUrls.map(p => `  <url>
    <loc>${site}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml.trim(), {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'max-age=3600'
        }
    });
};

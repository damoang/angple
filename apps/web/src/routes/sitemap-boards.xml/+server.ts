import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * 게시판 목록 Sitemap
 */
export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');
    const now = new Date().toISOString().split('T')[0];

    let boardUrls: string[] = [];

    try {
        // 검색 가능한 게시판만 조회
        const [boards] = await pool.query<RowDataPacket[]>(
            'SELECT bo_table, bo_subject FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order'
        );

        boardUrls = (boards as Array<{ bo_table: string; bo_subject: string }>).map(
            (board) => `  <url>
    <loc>${siteUrl}/${board.bo_table}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
        );
    } catch (err) {
        console.error('[Sitemap Boards] 게시판 목록 조회 실패:', err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${boardUrls.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // 1시간 캐시
        }
    });
};

import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { getSitemapPageSegments } from '$lib/server/sitemap.js';

/**
 * 게시글 Sitemap (분할)
 *
 * /sitemap-posts-1.xml, /sitemap-posts-2.xml, ...
 * 각 파일당 최대 40,000개 URL. 페이지 경계는 $lib/server/sitemap 매니페스트가 결정하며
 * index(sitemap.xml)와 공유해 항상 일치한다. 게시판당 캡 없이 전 글을 커버한다.
 */

export const GET: RequestHandler = async ({ params, url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');
    const pageNum = parseInt(params.page || '1', 10);

    if (isNaN(pageNum) || pageNum < 1) {
        return new Response('Invalid page number', { status: 400 });
    }

    const postUrls: string[] = [];

    try {
        const segments = await getSitemapPageSegments(pageNum);

        for (const seg of segments) {
            // 세그먼트 board 는 매니페스트에서 왔지만 방어적으로 재검증.
            if (!/^[a-zA-Z0-9_]+$/.test(seg.board)) continue;
            try {
                const [posts] = await pool.query<RowDataPacket[]>(
                    `SELECT wr_id, wr_datetime, wr_last, LEFT(wr_content, 1000) AS content_head
                     FROM g5_write_${seg.board}
					 WHERE wr_is_comment = 0
					 ORDER BY wr_id DESC
					 LIMIT ? OFFSET ?`,
                    [seg.limit, seg.offset]
                );

                for (const post of posts as Array<{
                    wr_id: number;
                    wr_datetime: string;
                    wr_last: string;
                    content_head: string;
                }>) {
                    const lastmod = post.wr_last || post.wr_datetime;
                    const lastmodDate = new Date(lastmod).toISOString().split('T')[0];
                    const imageUrl = extractFirstImage(post.content_head);
                    const imageTag = imageUrl
                        ? `\n    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>\n    </image:image>`
                        : '';

                    postUrls.push(`  <url>
    <loc>${siteUrl}/${seg.board}/${post.wr_id}</loc>
    <lastmod>${lastmodDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>${imageTag}
  </url>`);
                }
            } catch (err) {
                // 테이블이 없거나 쿼리 에러 - 로그만 남기고 계속
                console.error('[Sitemap Posts]', seg.board, '조회 실패:', err);
            }
        }
    } catch (err) {
        console.error('[Sitemap Posts]', pageNum, '조회 실패:', err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${postUrls.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // 1시간 캐시
        }
    });
};

const CDN_BASE = 'https://s3.damoang.net';

function extractFirstImage(content: string | null): string | null {
    if (!content) return null;
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (!match?.[1]) return null;
    let url = match[1];
    if (url.startsWith('/data/')) url = CDN_BASE + url;
    return url;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

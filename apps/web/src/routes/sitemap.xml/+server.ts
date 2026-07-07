import type { RequestHandler } from './$types';
import { getSitemapPageCount } from '$lib/server/sitemap.js';

/**
 * Sitemap Index 생성 엔드포인트
 * 대용량 사이트를 위해 sitemap을 분할하여 관리
 *
 * 구조:
 * - /sitemap.xml (index) - 분할된 sitemap 목록
 * - /sitemap-static.xml - 정적 페이지
 * - /sitemap-boards.xml - 게시판 목록
 * - /sitemap-posts-{page}.xml - 게시글 (40,000개씩 분할, 전 게시판 실제 글 수 기준)
 *
 * 페이지 수는 $lib/server/sitemap 의 매니페스트와 공유해 각 posts 페이지와 항상 일치.
 */

export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');
    const now = new Date().toISOString().split('T')[0];

    let postSitemapCount = 1;
    try {
        postSitemapCount = await getSitemapPageCount();
    } catch (err) {
        console.error('[Sitemap Index] 페이지 수 계산 실패:', err);
    }

    const sitemaps: string[] = [
        // 정적 페이지
        `  <sitemap>
    <loc>${siteUrl}/sitemap-static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`,
        // 게시판 목록
        `  <sitemap>
    <loc>${siteUrl}/sitemap-boards.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`
    ];

    // 게시글 sitemap (분할) — 전 게시판 실제 글 수 기준 전체 페이지 등재
    for (let i = 1; i <= postSitemapCount; i++) {
        sitemaps.push(`  <sitemap>
    <loc>${siteUrl}/sitemap-posts-${i}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // 1시간 캐시
        }
    });
};

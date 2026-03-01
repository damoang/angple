import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * Sitemap Index 생성 엔드포인트
 * 대용량 사이트를 위해 sitemap을 분할하여 관리
 *
 * 구조:
 * - /sitemap.xml (index) - 분할된 sitemap 목록
 * - /sitemap-static.xml - 정적 페이지
 * - /sitemap-boards.xml - 게시판 목록
 * - /sitemap-posts-{page}.xml - 게시글 (50,000개씩 분할)
 */

const POSTS_PER_SITEMAP = 40000; // Google 권장 최대 50,000개

export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');

    // 전체 게시글 수 조회 (sitemap 분할 계산용)
    let totalPosts = 0;
    try {
        // 주요 게시판 목록 조회
        const [boards] = await pool.query<RowDataPacket[]>(
            'SELECT bo_table FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order LIMIT 30'
        );

        for (const board of boards as Array<{ bo_table: string }>) {
            const boTable = board.bo_table;
            // SQL injection 방지
            if (!/^[a-zA-Z0-9_]+$/.test(boTable)) continue;

            try {
                const [countResult] = await pool.query<RowDataPacket[]>(
                    `SELECT COUNT(*) as cnt FROM g5_write_${boTable} WHERE wr_is_comment = 0`
                );
                totalPosts += (countResult[0] as { cnt: number }).cnt || 0;
            } catch {
                // 테이블이 없을 수 있음
            }
        }
    } catch (err) {
        console.error('[Sitemap Index] 게시글 수 조회 실패:', err);
    }

    // 게시글 sitemap 페이지 수 계산
    const postSitemapCount = Math.max(1, Math.ceil(totalPosts / POSTS_PER_SITEMAP));
    const now = new Date().toISOString().split('T')[0];

    // Sitemap Index 생성
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

    // 게시글 sitemap (분할)
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

import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * 게시글 Sitemap (분할)
 *
 * /sitemap-posts-1.xml, /sitemap-posts-2.xml, ...
 * 각 파일당 최대 40,000개 URL
 */

const POSTS_PER_PAGE = 40000;
const POSTS_PER_BOARD = 2000; // 각 게시판당 최대 게시글 수

export const GET: RequestHandler = async ({ params, url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');
    const pageNum = parseInt(params.page || '1', 10);

    if (isNaN(pageNum) || pageNum < 1) {
        return new Response('Invalid page number', { status: 400 });
    }

    const globalOffset = (pageNum - 1) * POSTS_PER_PAGE;
    const postUrls: string[] = [];

    try {
        // 주요 게시판 목록 조회
        const [boards] = await pool.query<RowDataPacket[]>(
            'SELECT bo_table FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order'
        );

        let totalCollected = 0;
        let skipped = 0;

        for (const board of boards as Array<{ bo_table: string }>) {
            if (totalCollected >= POSTS_PER_PAGE) break;

            const boTable = board.bo_table;
            // SQL injection 방지
            if (!/^[a-zA-Z0-9_]+$/.test(boTable)) continue;

            try {
                // 이 게시판에서 가져올 게시글 수 계산
                const toSkipInThisBoard = Math.max(0, globalOffset - skipped);
                const toCollect = Math.min(POSTS_PER_BOARD, POSTS_PER_PAGE - totalCollected);

                // 아직 건너뛸 게시글이 남아있으면 이 게시판 카운트만 확인
                if (toSkipInThisBoard >= POSTS_PER_BOARD) {
                    skipped += POSTS_PER_BOARD;
                    continue;
                }

                const [posts] = await pool.query<RowDataPacket[]>(
                    `SELECT wr_id, wr_datetime, wr_last FROM g5_write_${boTable}
					 WHERE wr_is_comment = 0
					 ORDER BY wr_id DESC
					 LIMIT ? OFFSET ?`,
                    [toCollect, toSkipInThisBoard]
                );

                for (const post of posts as Array<{
                    wr_id: number;
                    wr_datetime: string;
                    wr_last: string;
                }>) {
                    // lastmod: 수정일(wr_last)이 있으면 수정일, 없으면 작성일
                    const lastmod = post.wr_last || post.wr_datetime;
                    const lastmodDate = new Date(lastmod).toISOString().split('T')[0];

                    postUrls.push(`  <url>
    <loc>${siteUrl}/${boTable}/${post.wr_id}</loc>
    <lastmod>${lastmodDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`);
                    totalCollected++;
                }

                skipped += POSTS_PER_BOARD;
            } catch (err) {
                // 테이블이 없거나 쿼리 에러 - 로그만 남기고 계속
                console.error('[Sitemap Posts]', boTable, '조회 실패:', err);
            }
        }
    } catch (err) {
        console.error('[Sitemap Posts]', pageNum, '조회 실패:', err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${postUrls.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // 1시간 캐시
        }
    });
};

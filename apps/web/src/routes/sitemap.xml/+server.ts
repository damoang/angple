import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * 동적 Sitemap 생성 엔드포인트
 * g5_board, g5_write_{bo_table} 테이블에서 동적으로 URL 생성
 */
export const GET: RequestHandler = async ({ url }) => {
	const siteUrl = url.origin;

	// 정적 페이지
	const staticPages = [
		{ loc: '/', priority: '1.0', changefreq: 'daily' },
		{ loc: '/search', priority: '0.5', changefreq: 'weekly' },
		{ loc: '/login', priority: '0.3', changefreq: 'monthly' },
		{ loc: '/terms', priority: '0.2', changefreq: 'yearly' },
		{ loc: '/privacy', priority: '0.2', changefreq: 'yearly' },
		{ loc: '/policy', priority: '0.2', changefreq: 'yearly' },
		{ loc: '/level', priority: '0.2', changefreq: 'yearly' },
		{ loc: '/guide', priority: '0.3', changefreq: 'monthly' },
		{ loc: '/advertising', priority: '0.2', changefreq: 'monthly' }
	];

	// 게시판 목록
	let boardUrls: Array<{ loc: string; priority: string; changefreq: string }> = [];
	try {
		const [boards] = await pool.query<RowDataPacket[]>(
			'SELECT bo_table FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order'
		);

		boardUrls = (boards as Array<{ bo_table: string }>).map((b) => ({
			loc: `/${b.bo_table}`,
			priority: '0.7',
			changefreq: 'daily'
		}));
	} catch (err) {
		console.error('[Sitemap] 게시판 목록 조회 실패:', err);
	}

	// 최근 게시글 (주요 게시판에서 최대 5000개)
	let postUrls: Array<{ loc: string; lastmod: string; priority: string; changefreq: string }> = [];
	try {
		// 주요 게시판 목록에서 최근 게시글 조회
		const boardTables = boardUrls.slice(0, 20).map((b) => b.loc.slice(1));

		for (const boTable of boardTables) {
			// SQL injection 방지: 테이블명은 영숫자/밑줄만 허용
			if (!/^[a-zA-Z0-9_]+$/.test(boTable)) continue;

			try {
				const [posts] = await pool.query<RowDataPacket[]>(
					`SELECT wr_id, wr_datetime FROM g5_write_${boTable}
					 WHERE wr_is_comment = 0
					 ORDER BY wr_datetime DESC LIMIT 250`
				);

				for (const post of posts as Array<{ wr_id: number; wr_datetime: string }>) {
					postUrls.push({
						loc: `/${boTable}/${post.wr_id}`,
						lastmod: new Date(post.wr_datetime).toISOString().split('T')[0],
						priority: '0.5',
						changefreq: 'weekly'
					});
				}
			} catch {
				// 테이블이 없을 수 있음 (무시)
			}

			if (postUrls.length >= 5000) break;
		}

		postUrls = postUrls.slice(0, 5000);
	} catch (err) {
		console.error('[Sitemap] 게시글 조회 실패:', err);
	}

	const allUrls = [
		...staticPages.map(
			(page) => `  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
		),
		...boardUrls.map(
			(page) => `  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
		),
		...postUrls.map(
			(page) => `  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
		)
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=3600'
		}
	});
};

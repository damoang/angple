import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * 전체 RSS 피드 (최근 게시글)
 * RSS 2.0 규격
 */
export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin;
    const siteTitle = import.meta.env.VITE_SITE_NAME || 'Angple';
    const siteDescription = `${siteTitle} 커뮤니티 - 최근 게시글`;

    let items = '';

    try {
        // 주요 게시판에서 최근 게시글 20개
        const [boards] = await pool.query<RowDataPacket[]>(
            'SELECT bo_table, bo_subject FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order LIMIT 10'
        );

        const allPosts: Array<{
            title: string;
            link: string;
            description: string;
            author: string;
            pubDate: string;
            boardSubject: string;
        }> = [];

        for (const board of boards as Array<{ bo_table: string; bo_subject: string }>) {
            if (!/^[a-zA-Z0-9_]+$/.test(board.bo_table)) continue;

            try {
                const [posts] = await pool.query<RowDataPacket[]>(
                    `SELECT wr_id, wr_subject, wr_content, wr_name, wr_datetime
					 FROM g5_write_${board.bo_table}
					 WHERE wr_is_comment = 0
					 ORDER BY wr_datetime DESC LIMIT 5`
                );

                for (const post of posts as Array<{
                    wr_id: number;
                    wr_subject: string;
                    wr_content: string;
                    wr_name: string;
                    wr_datetime: string;
                }>) {
                    allPosts.push({
                        title: escapeXml(post.wr_subject),
                        link: `${siteUrl}/${board.bo_table}/${post.wr_id}`,
                        description: escapeXml(stripHtmlTags(post.wr_content).slice(0, 200)),
                        author: escapeXml(post.wr_name),
                        pubDate: new Date(post.wr_datetime).toUTCString(),
                        boardSubject: escapeXml(board.bo_subject)
                    });
                }
            } catch {
                // 테이블이 없을 수 있음
            }
        }

        // 날짜순 정렬 후 상위 20개
        allPosts.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

        items = allPosts
            .slice(0, 20)
            .map(
                (post) => `    <item>
      <title>${post.title}</title>
      <link>${post.link}</link>
      <description>${post.description}</description>
      <author>${post.author}</author>
      <pubDate>${post.pubDate}</pubDate>
      <category>${post.boardSubject}</category>
      <guid isPermaLink="true">${post.link}</guid>
    </item>`
            )
            .join('\n');
    } catch (err) {
        console.error('[RSS] 피드 생성 실패:', err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteTitle}</title>
    <link>${siteUrl}</link>
    <description>${siteDescription}</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'max-age=1800'
        }
    });
};

/** HTML 태그를 반복 제거 (중첩 태그 우회 방지) */
function stripHtmlTags(str: string): string {
    let result = str;
    let prev;
    do {
        prev = result;
        result = result.replace(/<[^>]+>/g, '');
    } while (result !== prev);
    return result;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

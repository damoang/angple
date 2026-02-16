import type { RequestHandler } from './$types';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * 게시판별 RSS 피드
 * RSS 2.0 규격
 */
export const GET: RequestHandler = async ({ url, params }) => {
    const siteUrl = url.origin;
    const siteTitle = import.meta.env.VITE_SITE_NAME || 'Angple';
    const boardId = params.boardId;

    // 테이블명 검증 (SQL injection 방지)
    if (!/^[a-zA-Z0-9_]+$/.test(boardId)) {
        return new Response('Invalid board ID', { status: 400 });
    }

    // 게시판 정보 조회
    let boardSubject = boardId;
    try {
        const [boards] = await pool.query<RowDataPacket[]>(
            'SELECT bo_subject FROM g5_board WHERE bo_table = ? LIMIT 1',
            [boardId]
        );
        if ((boards as Array<{ bo_subject: string }>)[0]) {
            boardSubject = (boards as Array<{ bo_subject: string }>)[0].bo_subject;
        }
    } catch {
        // 무시
    }

    let items = '';

    try {
        const [posts] = await pool.query<RowDataPacket[]>(
            `SELECT wr_id, wr_subject, wr_content, wr_name, wr_datetime
			 FROM g5_write_${boardId}
			 WHERE wr_is_comment = 0
			 ORDER BY wr_datetime DESC LIMIT 20`
        );

        items = (
            posts as Array<{
                wr_id: number;
                wr_subject: string;
                wr_content: string;
                wr_name: string;
                wr_datetime: string;
            }>
        )
            .map(
                (post) => `    <item>
      <title>${escapeXml(post.wr_subject)}</title>
      <link>${siteUrl}/${boardId}/${post.wr_id}</link>
      <description>${escapeXml(stripHtmlTags(post.wr_content).slice(0, 200))}</description>
      <author>${escapeXml(post.wr_name)}</author>
      <pubDate>${new Date(post.wr_datetime).toUTCString()}</pubDate>
      <guid isPermaLink="true">${siteUrl}/${boardId}/${post.wr_id}</guid>
    </item>`
            )
            .join('\n');
    } catch (err) {
        console.error('[RSS] %s 피드 생성 실패:', boardId, err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(boardSubject)} - ${escapeXml(siteTitle)}</title>
    <link>${siteUrl}/${boardId}</link>
    <description>${escapeXml(boardSubject)} 게시판 최근 게시글</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss/${boardId}" rel="self" type="application/rss+xml"/>
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

import type { RequestHandler } from './$types';
import { rssEtag, etagMatches, rssHeaders } from './headers.js';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { findDisciplinedIds } from '$lib/server/discipline-mask.js';

/**
 * 전체 RSS 피드 (최근 게시글)
 * RSS 2.0 규격
 */
export const GET: RequestHandler = async ({ url, request }) => {
    const siteUrl = url.origin;
    const siteTitle = import.meta.env.VITE_SITE_NAME || 'Angple';
    const siteDescription = `${siteTitle} 커뮤니티 - 최근 게시글`;

    let items = '';

    try {
        // 주요 게시판에서 최근 게시글 20개
        const [boards] = await pool.query<RowDataPacket[]>(
            // ⛔ `bo_use_search` 만 보면 회원/관리자 전용 보드가 섞인다.
            //    gnuboard 규약상 비회원 = 레벨 1 이므로 `<= 1` 만 게스트 공개다.
            `SELECT bo_table, bo_subject FROM g5_board
              WHERE bo_use_search = 1 AND bo_list_level <= 1 AND bo_read_level <= 1
              ORDER BY bo_order LIMIT 10`
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
					   AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')
					 ORDER BY wr_datetime DESC LIMIT 5`
                );

                const typedPosts = posts as Array<{
                    wr_id: number;
                    wr_subject: string;
                    wr_content: string;
                    wr_name: string;
                    wr_datetime: string;
                }>;
                // 이용제한 근거 글은 **피드에서 제외한다**(제목 치환이 아니라).
                //
                // ⛔ 예전에는 제목을 '[이용제한 근거 글]' 로 치환해 내보냈다. 그러면 작성자
                //    닉네임·원문 링크와 함께 「이 회원의 이 글이 이용제한 근거였다」는 사실이
                //    **공개 피드로 공표**된다. 외부 서비스가 수집해 가면 되돌릴 수 없다.
                //
                // ⭐ 같은 판단이 이미 저장소 안에 있다 — daily-recommended-loader.ts:
                //    「추천 피드이므로 마스킹(제목 치환)보다 **목록에서 제외**가 맞다」
                //    RSS 도 같은 성격의 피드다. 규칙을 맞춘다.
                const disciplined = await findDisciplinedIds(
                    board.bo_table,
                    typedPosts.map((p) => p.wr_id)
                );
                for (const post of typedPosts) {
                    if (disciplined.has(post.wr_id)) continue;
                    allPosts.push({
                        title: escapeXml(post.wr_subject),
                        link: `${siteUrl}/${board.bo_table}/${post.wr_id}`,
                        // ⛔ 본문을 피드에 싣지 않는다.
                        //
                        //    2026-09-15 실측: /rss 요청 7일 810건 중 **631건(78%)이 자칭 수집기**다
                        //    (trend-archive 337 · CollectorHub 294). 사람이 RSS 리더로 읽는 것은
                        //    Feedly 46건 수준이다. 본문 200자를 실어 보내면 **얻는 쪽보다
                        //    가져가는 쪽이 13배 많다.**
                        //
                        //    ⭐ 마침 외부 서비스가 「본문·댓글·이미지는 복사하지 않겠다」고
                        //    문의해 왔는데, 정작 우리 피드가 먼저 본문을 건네주고 있었다.
                        //
                        //    ⛔ 태그 자체는 남긴다. RSS 리더가 파싱에 기대는 경우가 있고,
                        //    item 에는 title 이 있으므로 빈 description 은 규격상 문제없다.
                        //    제목을 여기 또 넣지 않는다 — <title> 과 중복이다.
                        description: '',
                        author: escapeXml(post.wr_name),
                        pubDate: new Date(post.wr_datetime).toUTCString(),
                        boardSubject: escapeXml(board.bo_subject)
                    });
                }
            } catch {
                // 테이블이 없을 수 있음
            }
        }

        // ⛔ 이미지(media:content)를 싣지 않는다 — 되살리지 마라.
        //    본문을 빼면서 이미지 주소만 떠먹여 주는 것은 앞뒤가 맞지 않는다.
        //    2026-09 에 수집기(CollectorHub)가 media:content 를 따라가 이미지를
        //    실제로 가져간 기록이 있다. 이미지 자체는 CDN 에 공개돼 있으므로
        //    **막는 것이 아니라 피드로 알려주지 않는** 것이다.
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
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
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

    // ⭐ 본문을 만든 뒤 해시로 판정한다. 삭제·수정·마스킹 무엇이든 여기 반영된다.
    const etag = rssEtag(xml);
    if (etagMatches(request, etag)) {
        return new Response(null, { status: 304, headers: rssHeaders(etag) });
    }
    return new Response(xml, { headers: rssHeaders(etag) });
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

const CDN_BASE = 'https://s3.damoang.net';

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

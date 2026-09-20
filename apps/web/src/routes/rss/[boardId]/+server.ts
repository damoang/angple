import type { RequestHandler } from './$types';
import { rssEtag, etagMatches, rssHeaders } from '../headers.js';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { findDisciplinedIds } from '$lib/server/discipline-mask.js';

/**
 * 게스트에게 공개된 보드의 경계.
 *
 * ⛔ gnuboard 규약에서 **비회원 = 레벨 1** 이다(v2 백엔드의 0 과 다르다).
 *    그래서 `<= 1` 이 「게스트 공개」이고, 2 이상은 회원/관리자 전용이다.
 *    실측(2026-08-31): 공개 121개 · 제한인데 피드가 열려 있던 것 2개
 *    (`opsreport` 레벨 10 = 관리자 전용, `promotion_archive` 레벨 5 = 글 20건 실제 노출).
 */
const GUEST_LEVEL = 1;

/**
 * 게시판별 RSS 피드
 * RSS 2.0 규격
 */
export const GET: RequestHandler = async ({ url, params, request }) => {
    const siteUrl = url.origin;
    const siteTitle = import.meta.env.VITE_SITE_NAME || 'Angple';
    const boardId = params.boardId;

    // 테이블명 검증 (SQL injection 방지)
    if (!/^[a-zA-Z0-9_]+$/.test(boardId)) {
        return new Response('Invalid board ID', { status: 400 });
    }

    // 게시판 정보 조회 + 공개 여부 판정
    //
    // ⛔ 예전에는 이 블록이 `catch { /* 무시 */ }` 였다. 조회가 던지면 게이트를 건너뛰고
    //    그대로 피드를 내줬다 — **fail-open**. 이 게이트가 관리자·소명·이용제한 기록
    //    게시판을 RSS 로부터 지키는 **유일한 장치**다. 실패하면 닫는다.
    let boardSubject = boardId;
    try {
        const [boards] = await pool.query<RowDataPacket[]>(
            `SELECT bo_subject, bo_use_search, bo_list_level, bo_read_level
             FROM g5_board WHERE bo_table = ? LIMIT 1`,
            [boardId]
        );
        const row = (
            boards as Array<{
                bo_subject: string;
                bo_use_search: number;
                bo_list_level: number;
                bo_read_level: number;
            }>
        )[0];
        // ⛔ `bo_use_search` 만으로는 부족하다. 검색에 노출되는 것과 비회원이 본문을
        //    읽어도 되는 것은 다른 판단이다.
        const guestVisible =
            !!row &&
            row.bo_use_search === 1 &&
            Number(row.bo_list_level) <= GUEST_LEVEL &&
            Number(row.bo_read_level) <= GUEST_LEVEL;
        if (!guestVisible) {
            return new Response('Not Found', { status: 404 });
        }
        boardSubject = row.bo_subject;
    } catch (err) {
        console.error('[rss] 게시판 공개 여부 조회 실패 — 닫는다', boardId, err);
        return new Response('Not Found', { status: 404 });
    }

    let items = '';

    try {
        const [posts] = await pool.query<RowDataPacket[]>(
            `SELECT wr_id, wr_subject, wr_content, wr_name, wr_datetime
			 FROM g5_write_${boardId}
			 WHERE wr_is_comment = 0
			   AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')
			 ORDER BY wr_datetime DESC LIMIT 20`
        );

        const rows = posts as Array<{
            wr_id: number;
            wr_subject: string;
            wr_content: string;
            wr_name: string;
            wr_datetime: string;
        }>;

        // 이용제한 근거 글은 **피드에서 제외한다**(제목 치환이 아니라).
        //
        // ⛔ 예전에는 제목·본문을 '[이용제한 근거 글]' 로 치환해 내보냈다. 그러면
        //    작성자 닉네임·원문 링크와 함께 「이 회원의 이 글이 이용제한 근거였다」는
        //    사실이 **공개 피드로 공표**된다. 외부가 수집해 가면 되돌릴 수 없다.
        //
        // ⭐ discipline-mask.ts 가 밝힌 목적(원문 제목 은닉 · auth 무관 캐시 ·
        //    봇 추출 차단)은 **제외가 더 잘 달성한다** — 아예 안 내보내므로.
        //    헬퍼의 계약은 그대로 두고 **피드 표면에서만** 제외로 바꾼다.
        //    같은 선택이 daily-recommended-loader.ts 에 이미 있다:
        //    「추천 피드이므로 마스킹보다 목록에서 제외가 맞다」
        const disciplined = await findDisciplinedIds(
            boardId,
            rows.map((p) => p.wr_id)
        );

        // ⛔ 본문을 피드에 싣지 않는다(2026-09-15). 인덱스 피드와 같은 이유 —
        //    /rss 요청 7일 810건 중 631건(78%)이 자칭 수집기다(trend-archive·CollectorHub).
        //    사람이 리더로 읽는 것은 Feedly 46건 수준. 본문을 실으면 가져가는 쪽만 이득이다.
        //    태그는 남긴다 — item 에 title 이 있으므로 빈 description 은 규격상 문제없다.
        items = rows
            .filter((post) => !disciplined.has(post.wr_id))
            .map((post) => {
                return `    <item>
      <title>${escapeXml(post.wr_subject)}</title>
      <link>${siteUrl}/${boardId}/${post.wr_id}</link>
      <description></description>
      <author>${escapeXml(post.wr_name)}</author>
      <pubDate>${new Date(post.wr_datetime).toUTCString()}</pubDate>
      <guid isPermaLink="true">${siteUrl}/${boardId}/${post.wr_id}</guid>
    </item>`;
            })
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

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

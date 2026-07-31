/**
 * 회원 공감 내역 API
 * GET /api/members/[id]/liked?page=1&limit=10[&q=검색어]
 *
 * 해당 회원이 추천한 글 목록. q 가 있으면 제목 검색 (#13116).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import { getMemberLikedVersion } from '$lib/server/member-activity-cache';
import { isWithdrawnMember } from '../_withdrawn';

interface GoodRow extends RowDataPacket {
    bg_id: number;
    bo_table: string;
    wr_id: number;
    bg_datetime: string;
}

interface BoardRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
}

interface WriteRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    wr_datetime: string;
    is_deleted: number;
}

interface CountRow extends RowDataPacket {
    count: number;
}

const MEMBER_LIKED_CACHE_TTL_SEC = 30;

// #13116 제목 검색: 공감이 아주 많은 회원 보호용 스캔 상한. 최근 공감부터 이 개수까지만
// 검색 대상으로 삼고, 상한에 걸리면 응답에 capped 로 알린다(조용한 잘림 금지).
const SEARCH_SCAN_CAP = 2000;

/** LIKE 패턴 이스케이프 — %, _, \ 를 리터럴로 */
function escapeLike(s: string): string {
    return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export const GET: RequestHandler = async ({ params, url }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_-]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '10')), 30);
    const offset = (page - 1) * limit;
    // #13116: 제목 검색어 (선택). 2자 미만은 무시 — 한 글자 LIKE 는 사실상 전체 스캔이다.
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const searching = q.length >= 2;

    // 탈퇴 회원 공감내역 비노출 (개인정보 분쟁조정 대응)
    if (await isWithdrawnMember(memberId)) {
        return json({ success: true, data: [], total: 0, page, total_pages: 0 });
    }

    try {
        const version = await getMemberLikedVersion(memberId);
        const cacheKey = `member_liked:${memberId}:${page}:${limit}:v${version}${
            searching ? `:q:${encodeURIComponent(q)}` : ''
        }`;
        try {
            const cached = await getRedis().get(cacheKey);
            if (cached) {
                return new Response(cached, {
                    status: 200,
                    headers: { 'content-type': 'application/json; charset=utf-8' }
                });
            }
        } catch {
            // Redis 장애 시 DB fallback
        }

        // 총 추천 수 (검색 시에는 필터 후 개수를 아래에서 다시 센다)
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS count FROM g5_board_good WHERE mb_id = ? AND bg_flag = 'good'`,
            [memberId]
        );
        const allTotal = countRows[0]?.count ?? 0;

        // 추천 목록.
        // 검색 시에는 어느 공감이 제목에 매치될지 모르므로 페이지 오프셋을 걸 수 없다 —
        // 최근 SEARCH_SCAN_CAP 개를 후보로 가져와 매치 후 JS 에서 페이지네이션한다.
        const [goodRows] = searching
            ? await pool.query<GoodRow[]>(
                  `SELECT bg_id, bo_table, wr_id, bg_datetime
			 FROM g5_board_good
			 WHERE mb_id = ? AND bg_flag = 'good'
			 ORDER BY bg_id DESC
			 LIMIT ?`,
                  [memberId, SEARCH_SCAN_CAP]
              )
            : await pool.query<GoodRow[]>(
                  `SELECT bg_id, bo_table, wr_id, bg_datetime
			 FROM g5_board_good
			 WHERE mb_id = ? AND bg_flag = 'good'
			 ORDER BY bg_id DESC
			 LIMIT ? OFFSET ?`,
                  [memberId, limit, offset]
              );

        // 게시판명 조회
        const tables = [...new Set(goodRows.map((r) => r.bo_table))];
        const boardSubjects = new Map<string, string>();
        if (tables.length > 0) {
            const placeholders = tables.map(() => '?').join(', ');
            const [boardRows] = await pool.query<BoardRow[]>(
                `SELECT bo_table, bo_subject FROM g5_board WHERE bo_table IN (${placeholders}) AND bo_use_search = 1`,
                tables
            );
            for (const b of boardRows) {
                boardSubjects.set(b.bo_table, b.bo_subject);
            }
        }

        // 글 메타 조회 — 보드별 member_activity_feed 배치 IN 쿼리
        const groupedByBoard = new Map<string, number[]>();
        for (const row of goodRows) {
            if (!/^[a-zA-Z0-9_]+$/.test(row.bo_table)) continue;
            if (!boardSubjects.has(row.bo_table)) continue;
            const ids = groupedByBoard.get(row.bo_table);
            if (ids) ids.push(row.wr_id);
            else groupedByBoard.set(row.bo_table, [row.wr_id]);
        }

        const writeMap = new Map<string, WriteRow>();
        await Promise.all(
            Array.from(groupedByBoard.entries()).map(async ([boTable, wrIds]) => {
                try {
                    // #13174 후속: 삭제글도 가져와 [삭제된 게시물] 자리표시자로 표시한다.
                    // 종전 is_deleted=0 은 공감했던 글이 삭제되면 내역에서 조용히 사라졌다.
                    // #13116 검색 시에는 삭제글을 제외한다 — 피드에 캐시된 원제가 매치에
                    // 쓰이면 검색어를 바꿔가며 삭제글 제목을 탐침할 수 있다(유출).
                    const [writeRows] = searching
                        ? await pool.query<WriteRow[]>(
                              `SELECT write_id AS wr_id, title AS wr_subject, source_created_at AS wr_datetime,
                                is_deleted
                           FROM member_activity_feed
                          WHERE board_id = ? AND write_id IN (?) AND activity_type = 1
                            AND is_deleted = 0 AND title LIKE ? ESCAPE '\\\\'`,
                              [boTable, wrIds, `%${escapeLike(q)}%`]
                          )
                        : await pool.query<WriteRow[]>(
                              `SELECT write_id AS wr_id, title AS wr_subject, source_created_at AS wr_datetime,
                                is_deleted
                           FROM member_activity_feed
                          WHERE board_id = ? AND write_id IN (?) AND activity_type = 1`,
                              [boTable, wrIds]
                          );
                    for (const w of writeRows) {
                        writeMap.set(`${boTable}:${w.wr_id}`, w);
                    }
                } catch {
                    // 테이블 없으면 스킵
                }
            })
        );

        const items = [];
        for (const row of goodRows) {
            const w = writeMap.get(`${row.bo_table}:${row.wr_id}`);
            if (!w) continue;
            // 삭제글: 피드에 캐시된 원제를 서버에서 비우고 deleted 플래그만 내린다.
            // (민감 필드는 서버가 drop — 클라 가림 금지)
            const deleted = Number(w.is_deleted) === 1;
            items.push({
                bo_table: row.bo_table,
                bo_subject: boardSubjects.get(row.bo_table) || row.bo_table,
                wr_id: w.wr_id,
                wr_subject: deleted ? '' : w.wr_subject,
                wr_datetime: w.wr_datetime,
                bg_datetime: row.bg_datetime,
                deleted,
                href: deleted ? '' : `/${row.bo_table}/${w.wr_id}`
            });
        }

        // #13116 검색: 매치된 전체에서 JS 페이지네이션. capped 는 스캔 상한 도달 표시.
        const total = searching ? items.length : allTotal;
        const pageItems = searching ? items.slice(offset, offset + limit) : items;
        const capped = searching && goodRows.length >= SEARCH_SCAN_CAP;

        const payload = {
            success: true,
            data: pageItems,
            total,
            page,
            total_pages: Math.ceil(total / limit),
            ...(capped ? { capped: true, scanned: SEARCH_SCAN_CAP } : {})
        };

        try {
            await getRedis().setex(cacheKey, MEMBER_LIKED_CACHE_TTL_SEC, JSON.stringify(payload));
        } catch {
            // Redis 장애 무시
        }

        return json(payload);
    } catch (error) {
        console.error('[Member Liked API] error:', error);
        return json({ success: false, error: '공감 내역 조회에 실패했습니다.' }, { status: 500 });
    }
};

/**
 * 회원 공감 내역 API
 * GET /api/members/[id]/liked?page=1&limit=10
 *
 * 해당 회원이 추천한 글 목록
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import { getMemberLikedVersion } from '$lib/server/member-activity-cache';

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
}

interface CountRow extends RowDataPacket {
    count: number;
}

const MEMBER_LIKED_CACHE_TTL_SEC = 30;

export const GET: RequestHandler = async ({ params, url }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_-]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '10')), 30);
    const offset = (page - 1) * limit;

    try {
        const version = await getMemberLikedVersion(memberId);
        const cacheKey = `member_liked:${memberId}:${page}:${limit}:v${version}`;
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

        // 총 추천 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS count FROM g5_board_good WHERE mb_id = ? AND bg_flag = 'good'`,
            [memberId]
        );
        const total = countRows[0]?.count ?? 0;

        // 추천 목록
        const [goodRows] = await pool.query<GoodRow[]>(
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
                    const [writeRows] = await pool.query<WriteRow[]>(
                        `SELECT write_id AS wr_id, title AS wr_subject, source_created_at AS wr_datetime
                           FROM member_activity_feed
                          WHERE board_id = ? AND write_id IN (?) AND activity_type = 1 AND is_deleted = 0`,
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
            items.push({
                bo_table: row.bo_table,
                bo_subject: boardSubjects.get(row.bo_table) || row.bo_table,
                wr_id: w.wr_id,
                wr_subject: w.wr_subject,
                wr_datetime: w.wr_datetime,
                bg_datetime: row.bg_datetime,
                href: `/${row.bo_table}/${w.wr_id}`
            });
        }

        const payload = {
            success: true,
            data: items,
            total,
            page,
            total_pages: Math.ceil(total / limit)
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

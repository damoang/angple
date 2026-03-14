/**
 * 회원 검색 API (멘션 자동완성용)
 * GET /api/members/search?q=검색어&limit=10
 * g5_member 테이블에서 mb_nick 또는 mb_id로 검색
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;
const MIN_QUERY_LENGTH = 1;

export const GET: RequestHandler = async ({ url }) => {
    const query = url.searchParams.get('q')?.trim();
    const limitParam = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);

    if (!query || query.length < MIN_QUERY_LENGTH) {
        return json({ members: [], adminBlocked: false });
    }

    const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT);

    // 검색어 유효성 검사 (SQL injection 방지 - parameterized query 사용하지만 이중 보호)
    if (query.length > 50) {
        return json({ error: '검색어가 너무 깁니다.' }, { status: 400 });
    }

    try {
        // 먼저 정확한 admin ID/닉네임 매칭 확인 (LIKE 검색보다 우선)
        const [exactAdminRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM g5_member
			 WHERE (mb_nick = ? OR mb_id = ?)
			   AND mb_level >= 10
			   AND mb_leave_date = ''`,
            [query, query]
        );
        if (exactAdminRows[0]?.cnt > 0) {
            return json({ members: [], adminBlocked: true });
        }

        const searchPattern = `%${query}%`;
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT mb_id, mb_nick, mb_name, IFNULL(as_level, 1) as as_level
			 FROM g5_member
			 WHERE (mb_nick LIKE ? OR mb_id LIKE ?)
			   AND mb_leave_date = ''
			   AND mb_intercept_date = ''
			   AND mb_level < 10
			 ORDER BY
			   CASE WHEN mb_nick = ? THEN 0 WHEN mb_nick LIKE ? THEN 1 ELSE 2 END,
			   mb_nick
			 LIMIT ?`,
            [searchPattern, searchPattern, query, `${query}%`, limit]
        );

        const members = rows.map((row) => ({
            mb_id: row.mb_id,
            mb_nick: row.mb_nick,
            mb_name: row.mb_name,
            as_level: row.as_level
        }));

        let adminBlocked = false;
        if (members.length === 0) {
            const [adminRows] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) as cnt FROM g5_member
				 WHERE (mb_nick LIKE ? OR mb_id LIKE ?)
				   AND mb_level >= 10
				   AND mb_leave_date = ''`,
                [searchPattern, searchPattern]
            );
            adminBlocked = adminRows[0]?.cnt > 0;
        }

        return json({ members, adminBlocked });
    } catch (error) {
        console.error('Member search API error:', error);
        return json({ error: '회원 검색 실패' }, { status: 500 });
    }
};

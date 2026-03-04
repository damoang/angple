import type { PageServerLoad } from './$types.js';
import type { PointHistoryResponse } from '$lib/api/types.js';
import { pool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

interface MemberPointRow extends RowDataPacket {
    mb_point: number;
}

interface SumRow extends RowDataPacket {
    total: number;
}

interface CountRow extends RowDataPacket {
    cnt: number;
}

interface PointRow extends RowDataPacket {
    po_id: number;
    po_mb_id: string;
    po_content: string;
    po_point: number;
    po_datetime: string;
    po_expired: number;
    po_expire_date: string;
    po_rel_table: string;
    po_rel_id: string;
    po_rel_action: string;
}

export const load: PageServerLoad = async ({ url, locals }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const filter = (url.searchParams.get('filter') as 'all' | 'earned' | 'used') || 'all';

    if (!locals.user?.id) {
        return { page, limit, filter, pointData: null };
    }

    const mbId = locals.user.id;
    let pointData: PointHistoryResponse | null = null;

    try {
        // 필터 조건
        let filterClause = '';
        if (filter === 'earned') filterClause = ' AND po_point > 0';
        else if (filter === 'used') filterClause = ' AND po_point < 0';

        const offset = (page - 1) * limit;

        // 요약 3쿼리 + 카운트 + 데이터 병렬 실행
        const [[memberRows], [earnedRows], [usedRows], [countRows], [itemRows]] = await Promise.all(
            [
                pool.query<MemberPointRow[]>('SELECT mb_point FROM g5_member WHERE mb_id = ?', [
                    mbId
                ]),
                pool.query<SumRow[]>(
                    'SELECT COALESCE(SUM(po_point), 0) AS total FROM g5_point WHERE po_mb_id = ? AND po_point > 0',
                    [mbId]
                ),
                pool.query<SumRow[]>(
                    'SELECT COALESCE(ABS(SUM(po_point)), 0) AS total FROM g5_point WHERE po_mb_id = ? AND po_point < 0',
                    [mbId]
                ),
                pool.query<CountRow[]>(
                    `SELECT COUNT(*) AS cnt FROM g5_point WHERE po_mb_id = ?${filterClause}`,
                    [mbId]
                ),
                // pool.query 사용: pool.execute의 prepared statement는 LIMIT 파라미터 타입 오류 발생
                pool.query<PointRow[]>(
                    `SELECT po_id, po_mb_id, po_content, po_point, po_datetime,
				        po_expired, po_expire_date, po_rel_table, po_rel_id, po_rel_action
				 FROM g5_point WHERE po_mb_id = ?${filterClause}
				 ORDER BY po_id DESC LIMIT ? OFFSET ?`,
                    [mbId, limit, offset]
                )
            ]
        );

        const totalPoint = memberRows[0]?.mb_point ?? 0;
        const totalEarned = earnedRows[0]?.total ?? 0;
        const totalUsed = usedRows[0]?.total ?? 0;
        const total = countRows[0]?.cnt ?? 0;
        const totalPages = Math.ceil(total / limit);

        const items = itemRows.map((row) => ({
            id: row.po_id,
            mb_id: row.po_mb_id,
            po_content: row.po_content,
            po_point: row.po_point,
            // mysql2는 DATETIME을 Date 객체로 반환 → 문자열 변환 필수 (SvelteKit 직렬화)
            po_datetime:
                row.po_datetime instanceof Date
                    ? row.po_datetime
                          .toISOString()
                          .replace('T', ' ')
                          .replace(/\.\d{3}Z$/, '')
                    : String(row.po_datetime || ''),
            po_expired: row.po_expired === 1,
            po_expire_date:
                row.po_expire_date instanceof Date
                    ? row.po_expire_date.toISOString().split('T')[0]
                    : String(row.po_expire_date || ''),
            po_rel_table: row.po_rel_table || undefined,
            po_rel_id: row.po_rel_id || undefined,
            po_rel_action: row.po_rel_action || undefined
        }));

        pointData = {
            summary: {
                total_point: totalPoint,
                total_earned: totalEarned,
                total_used: totalUsed
            },
            items,
            total,
            page,
            limit,
            total_pages: totalPages
        };
    } catch (e) {
        console.error('[Points] DB query failed:', e);
    }

    return { page, limit, filter, pointData };
};

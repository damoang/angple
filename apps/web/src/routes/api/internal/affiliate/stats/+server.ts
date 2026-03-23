import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api';

interface StatusRow extends RowDataPacket {
    status: string;
    cnt: number;
}

interface AggregateRow extends RowDataPacket {
    total: number;
    recent_processed: number;
    recent_failed: number;
}

export const GET: RequestHandler = async ({ request }) => {
    if (!isInternalAppRequest(request)) {
        return internalOnlyErrorResponse();
    }

    try {
        const [statusRows] = await pool.query<StatusRow[]>(
            `SELECT status, COUNT(*) AS cnt FROM g5_affiliate_links GROUP BY status`
        );
        const [aggregateRows] = await pool.query<AggregateRow[]>(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN last_processed_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS recent_processed,
                SUM(CASE WHEN status = 'failed' AND updated_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS recent_failed
             FROM g5_affiliate_links`
        );

        return json({
            success: true,
            data: {
                by_status: statusRows,
                totals: aggregateRows[0] || {
                    total: 0,
                    recent_processed: 0,
                    recent_failed: 0
                }
            }
        });
    } catch (error) {
        console.error('[AffiliateStats] error:', error);
        return json(
            { success: false, message: '어필리에이트 통계 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

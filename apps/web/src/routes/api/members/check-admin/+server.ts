/**
 * 관리자 멘션 일괄 확인 API
 * POST /api/members/check-admin
 * 멘션된 회원 ID 목록 중 관리자(level >= 10)를 반환
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_IDS = 20;

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { ids } = await request.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return json({ adminIds: [] });
        }

        const limitedIds = ids
            .slice(0, MAX_IDS)
            .filter((id: string) => typeof id === 'string' && id.length <= 50);

        if (limitedIds.length === 0) {
            return json({ adminIds: [] });
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT mb_id FROM g5_member
			 WHERE mb_id IN (?) AND mb_level >= 10 AND mb_leave_date = ''`,
            [limitedIds]
        );

        return json({ adminIds: rows.map((r) => r.mb_id) });
    } catch (error) {
        console.error('Check admin API error:', error);
        return json({ adminIds: [] });
    }
};

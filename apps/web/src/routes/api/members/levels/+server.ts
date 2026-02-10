/**
 * 회원 레벨 배치 조회 API
 * GET /api/members/levels?ids=user1,user2,user3
 * g5_member 테이블에서 as_level (나리야 경험치 레벨) 조회
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_IDS = 100;

export const GET: RequestHandler = async ({ url }) => {
    const idsParam = url.searchParams.get('ids');

    if (!idsParam) {
        return json({ error: 'ids 파라미터가 필요합니다.' }, { status: 400 });
    }

    const ids = idsParam
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

    if (ids.length === 0) {
        return json({});
    }

    if (ids.length > MAX_IDS) {
        return json({ error: `최대 ${MAX_IDS}명까지 조회 가능합니다.` }, { status: 400 });
    }

    // mb_id 유효성 검사 (영문, 숫자, 언더스코어만 허용)
    for (const id of ids) {
        if (!/^[a-zA-Z0-9_]+$/.test(id)) {
            return json({ error: `유효하지 않은 회원 ID: ${id}` }, { status: 400 });
        }
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id, IFNULL(as_level, 1) as as_level FROM g5_member WHERE mb_id IN (${placeholders})`,
            ids
        );

        const levels: Record<string, number> = {};
        for (const row of rows) {
            levels[row.mb_id] = row.as_level;
        }

        return json(levels);
    } catch (error) {
        console.error('Member levels API error:', error);
        return json({ error: '회원 레벨 조회 실패' }, { status: 500 });
    }
};

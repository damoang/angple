// 조회수 동기화 API (cron 전용)
// POST /api/viewcount/sync?secret=XXX
//
// 인메모리 캐시를 MySQL에 일괄 동기화
// cron: */3 * * * * curl -s -X POST http://127.0.0.1:3011/api/viewcount/sync?secret=XXX
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { flushAll, size } from '$lib/server/viewcount';
import pool from '$lib/server/db';

const SYNC_SECRET = process.env.VIEWCOUNT_SYNC_SECRET || '';

export const POST: RequestHandler = async ({ url }) => {
    // secret 검증
    const secret = url.searchParams.get('secret');
    if (!SYNC_SECRET || secret !== SYNC_SECRET) {
        return json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const pendingSize = size();
    const snapshot = flushAll();

    if (snapshot.size === 0) {
        return json({ success: true, synced: 0 });
    }

    let synced = 0;
    let errors = 0;

    for (const [key, count] of snapshot) {
        const [boardId, postIdStr] = key.split(':');
        const postId = Number(postIdStr);

        if (!boardId || !postId) {
            errors++;
            continue;
        }

        try {
            const tableName = `g5_write_${boardId}`;
            await pool.query(
                `UPDATE ?? SET wr_hit = wr_hit + ? WHERE wr_id = ? AND wr_is_comment = 0`,
                [tableName, count, postId]
            );
            synced++;
        } catch (err) {
            console.error(`[viewcount sync] ${key} 실패:`, err);
            errors++;
        }
    }

    return json({
        success: true,
        synced,
        errors,
        pending_before: pendingSize
    });
};

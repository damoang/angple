/**
 * POST /api/plugins/brickang/locks/cleanup-expired
 *
 * 만료된 lock 행을 일괄 삭제. admin (mb_level >= 10) 전용.
 * cron 시스템이 없으면 외부에서 주기적으로 호출 (K8s CronJob 등).
 *
 * 응답: { deleted: <count> }
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../../server/auth.js';
import { cleanExpiredLocks } from '../../server/locks.js';

interface AdminLocals {
    user?: { mb_level?: number | null };
}

export async function POST(event: RequestEvent): Promise<Response> {
    requireUser(event);
    const locals = event.locals as AdminLocals;
    const level = locals.user?.mb_level ?? 0;
    if (level < 10) {
        throw error(403, 'admin only');
    }
    const deleted = await cleanExpiredLocks(1000);
    return json({ deleted });
}

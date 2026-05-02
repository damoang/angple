/**
 * DELETE /api/plugins/brickang/locks/:lock_id
 *
 * 사용자 본인의 위치 lock 해제. 다른 사람 lock 이면 404 (의도적으로 owner 노출 안 함).
 *
 * 응답: { released: true }
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../../server/auth.js';
import { releaseLock } from '../../server/locks.js';

export async function DELETE(event: RequestEvent): Promise<Response> {
    const user = requireUser(event);
    const lockId = Number(event.params.lock_id);
    if (!Number.isFinite(lockId) || lockId <= 0) {
        throw error(400, 'invalid lock_id');
    }
    const affected = await releaseLock(user.userId, lockId);
    if (affected === 0) {
        // 본인 lock 아니거나 이미 만료/소비됨 — 멱등 처리
        return json({ released: false });
    }
    return json({ released: true });
}

/**
 * POST /api/plugins/brickang/locks/acquire
 *
 * 자유 배치(silver/gold/diamond)용 위치 lock 획득.
 *
 * Body: { building_id, brick_type_slug, position: {x,y,z} }
 *
 * 검증:
 *   - 사용자 인증 필수
 *   - brick_type 이 자유 배치 등급(silver/gold/diamond)
 *   - building active
 *   - 좌표가 strategy.validate() 통과
 *   - UNIQUE 충돌(다른 사용자 점유) → 409
 *
 * 응답: 200 { lock_id, expires_at }  /  409 { error: 'position_locked' }
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../../server/auth.js';
import { getBrickTypeBySlug } from '../../server/brick-types.js';
import { getBuildingById, getOccupiedSet } from '../../server/buildings.js';
import { validateFreePosition, pickStrategy } from '../../server/placement.js';
import { acquireLock } from '../../server/locks.js';
import type { BrickPosition, BrickTypeSlug } from '../../types/index.js';

interface AcquireBody {
    building_id: number;
    brick_type_slug: BrickTypeSlug;
    position: BrickPosition;
}

export async function POST(event: RequestEvent): Promise<Response> {
    const user = requireUser(event);

    let body: AcquireBody;
    try {
        body = (await event.request.json()) as AcquireBody;
    } catch {
        throw error(400, 'invalid json');
    }

    if (!body.building_id) throw error(400, 'building_id required');
    if (!body.brick_type_slug) throw error(400, 'brick_type_slug required');
    if (
        !body.position ||
        !Number.isFinite(body.position.x) ||
        !Number.isFinite(body.position.y) ||
        !Number.isFinite(body.position.z)
    ) {
        throw error(400, 'position required');
    }

    const picked = pickStrategy(body.brick_type_slug);
    if (picked.kind !== 'free') {
        throw error(400, 'brick_type does not support free placement');
    }

    const brickType = await getBrickTypeBySlug(body.brick_type_slug);
    if (!brickType || !brickType.isActive) {
        throw error(400, `unknown brick_type: ${body.brick_type_slug}`);
    }

    const building = await getBuildingById(body.building_id);
    if (!building) throw error(404, 'building not found');
    if (building.status !== 'active') throw error(400, 'building not active');

    const occupied = await getOccupiedSet(body.building_id);
    const reason = validateFreePosition(body.brick_type_slug, building, body.position, occupied);
    if (reason) {
        throw error(400, reason);
    }

    const lock = await acquireLock(user.userId, body.building_id, body.position);
    if (!lock) {
        // 다른 사용자가 이미 lock 점유
        return json({ error: 'position_locked' }, { status: 409 });
    }

    return json({
        lock_id: lock.id,
        expires_at: lock.expiresAt.toISOString(),
        position: lock.position
    });
}

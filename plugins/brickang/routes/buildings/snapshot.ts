/**
 * GET /api/plugins/brickang/buildings/:id/snapshot
 * Redis 캐시 우선.
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getBuildingSnapshot } from '../../server/snapshot.js';

export async function GET(event: RequestEvent): Promise<Response> {
    const id = Number(event.params.id);
    if (!id) throw error(400, 'invalid building id');

    const snap = await getBuildingSnapshot(id);
    return json(snap);
}

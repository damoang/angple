/**
 * GET /api/plugins/brickang/buildings/:id
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getBuildingById } from '../../server/buildings.js';

export async function GET(event: RequestEvent): Promise<Response> {
    const id = Number(event.params.id);
    if (!id) throw error(400, 'invalid building id');

    const b = await getBuildingById(id);
    if (!b) throw error(404, 'building not found');

    const progress =
        b.targetBricks > 0 ? Math.min(100, (b.currentBricks / b.targetBricks) * 100) : 0;

    return json({
        id: b.id,
        name: b.name,
        description: b.description,
        target_bricks: b.targetBricks,
        current_bricks: b.currentBricks,
        progress_percent: progress,
        status: b.status,
        blueprint_data: b.blueprintData,
        dimension: { x: b.dimensionX, y: b.dimensionY, z: b.dimensionZ },
        season: b.season,
        created_at: b.createdAt,
        completed_at: b.completedAt
    });
}

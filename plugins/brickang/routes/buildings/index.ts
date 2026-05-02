/**
 * GET /api/plugins/brickang/buildings
 * 활성 건축물 목록.
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import { listActiveBuildings } from '../../server/buildings.js';

export async function GET(_event: RequestEvent): Promise<Response> {
    const buildings = await listActiveBuildings();
    return json({
        buildings: buildings.map((b) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            target_bricks: b.targetBricks,
            current_bricks: b.currentBricks,
            progress_percent:
                b.targetBricks > 0 ? Math.min(100, (b.currentBricks / b.targetBricks) * 100) : 0,
            status: b.status,
            dimension: { x: b.dimensionX, y: b.dimensionY, z: b.dimensionZ },
            season: b.season,
            created_at: b.createdAt,
            completed_at: b.completedAt
        }))
    });
}

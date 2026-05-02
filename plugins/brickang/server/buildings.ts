/**
 * 건축물 조회/갱신 헬퍼.
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { readPool, pool } from './db.js';
import type { Building, BuildingStatus, Blueprint } from '../types/index.js';

interface BuildingRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    target_bricks: number;
    current_bricks: number;
    status: string;
    blueprint_data: string | object | null;
    dimension_x: number;
    dimension_y: number;
    dimension_z: number;
    season: number;
    created_at: Date;
    completed_at: Date | null;
}

function rowToBuilding(r: BuildingRow): Building {
    let blueprint: Blueprint | null = null;
    if (r.blueprint_data) {
        if (typeof r.blueprint_data === 'string') {
            try {
                blueprint = JSON.parse(r.blueprint_data) as Blueprint;
            } catch {
                blueprint = null;
            }
        } else {
            blueprint = r.blueprint_data as Blueprint;
        }
    }
    return {
        id: r.id,
        name: r.name,
        description: r.description,
        targetBricks: r.target_bricks,
        currentBricks: r.current_bricks,
        status: r.status as BuildingStatus,
        blueprintData: blueprint,
        dimensionX: r.dimension_x,
        dimensionY: r.dimension_y,
        dimensionZ: r.dimension_z,
        season: r.season,
        createdAt: r.created_at,
        completedAt: r.completed_at
    };
}

export async function listActiveBuildings(): Promise<Building[]> {
    const [rows] = await readPool.query<BuildingRow[]>(
        `SELECT * FROM brickang_buildings WHERE status = 'active' ORDER BY created_at DESC`
    );
    return rows.map(rowToBuilding);
}

export async function getBuildingById(id: number): Promise<Building | null> {
    const [rows] = await readPool.query<BuildingRow[]>(
        'SELECT * FROM brickang_buildings WHERE id = ? LIMIT 1',
        [id]
    );
    return rows[0] ? rowToBuilding(rows[0]) : null;
}

/**
 * 트랜잭션 내에서 building 조회 (FOR UPDATE).
 */
export async function getBuildingForUpdate(
    conn: PoolConnection,
    id: number
): Promise<Building | null> {
    const [rows] = await conn.query<BuildingRow[]>(
        'SELECT * FROM brickang_buildings WHERE id = ? FOR UPDATE',
        [id]
    );
    return rows[0] ? rowToBuilding(rows[0]) : null;
}

export async function incrementCurrentBricks(
    conn: PoolConnection,
    id: number,
    delta: number
): Promise<void> {
    await conn.query(
        'UPDATE brickang_buildings SET current_bricks = current_bricks + ? WHERE id = ?',
        [delta, id]
    );
}

/**
 * 점유된 좌표 Set 조회 (placement.ts 가 사용).
 */
export async function getOccupiedSet(buildingId: number): Promise<Set<string>> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        'SELECT position_x, position_y, position_z FROM brickang_bricks WHERE building_id = ?',
        [buildingId]
    );
    const set = new Set<string>();
    for (const r of rows) {
        set.add(`${r.position_x},${r.position_y},${r.position_z}`);
    }
    return set;
}

export { pool };

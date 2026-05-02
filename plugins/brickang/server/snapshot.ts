/**
 * 건축물 스냅샷 (Redis 캐시).
 *
 * 키 패턴:
 *   brickang:building:{id}:snapshot   → 5분 TTL, 위치+등급 요약
 *   brickang:building:{id}:recent     → 최근 10개 (LIST)
 *   brickang:ranking:all              → 1시간 TTL
 *   brickang:ranking:monthly          → 10분 TTL
 *
 * Redis 미가용 환경에서도 동작하도록 try/catch 로 감싸 fallback (DB 직접 조회) 처리.
 */

import { getRedis } from '$lib/server/redis';
import { readPool } from './db.js';
import type { RowDataPacket } from 'mysql2/promise';

const SNAPSHOT_TTL_SEC = 5 * 60;

interface SnapshotRow extends RowDataPacket {
    total: number;
    by_type: string | null;
}

export interface BuildingSnapshot {
    buildingId: number;
    snapshotVersion: number;
    generatedAt: string;
    metadata: {
        total: number;
        byType: Record<string, number>;
    };
}

function snapshotKey(buildingId: number): string {
    return `brickang:building:${buildingId}:snapshot`;
}

export async function invalidateBuildingSnapshot(buildingId: number): Promise<void> {
    try {
        const redis = getRedis();
        await redis.del(snapshotKey(buildingId));
    } catch (err) {
        console.warn('[brickang/snapshot] redis del failed:', (err as Error).message);
    }
}

export async function getBuildingSnapshot(buildingId: number): Promise<BuildingSnapshot> {
    // 1) Redis 캐시 hit
    try {
        const redis = getRedis();
        const cached = await redis.get(snapshotKey(buildingId));
        if (cached) {
            return JSON.parse(cached) as BuildingSnapshot;
        }
    } catch (err) {
        // Redis 없으면 DB 로 fallback
        console.warn('[brickang/snapshot] redis get failed:', (err as Error).message);
    }

    // 2) DB 직접 조회 → 새 snapshot 빌드
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT bt.slug AS slug, COUNT(*) AS cnt
         FROM brickang_bricks b
         INNER JOIN brickang_brick_types bt ON bt.id = b.brick_type_id
         WHERE b.building_id = ?
         GROUP BY bt.slug`,
        [buildingId]
    );

    const byType: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
        const slug = r.slug as string;
        const cnt = Number(r.cnt);
        byType[slug] = cnt;
        total += cnt;
    }

    const snapshot: BuildingSnapshot = {
        buildingId,
        snapshotVersion: Date.now(),
        generatedAt: new Date().toISOString(),
        metadata: { total, byType }
    };

    try {
        const redis = getRedis();
        await redis.set(snapshotKey(buildingId), JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SEC);
    } catch (err) {
        console.warn('[brickang/snapshot] redis set failed:', (err as Error).message);
    }

    return snapshot;
}

export async function pushRecentBrick(
    buildingId: number,
    brick: { id: number; nickname: string; brickTypeSlug: string; placedAt: string }
): Promise<void> {
    try {
        const redis = getRedis();
        const key = `brickang:building:${buildingId}:recent`;
        await redis.lpush(key, JSON.stringify(brick));
        await redis.ltrim(key, 0, 9);
        await redis.expire(key, 60 * 60); // 1시간
    } catch (err) {
        console.warn('[brickang/snapshot] redis recent push failed:', (err as Error).message);
    }
}

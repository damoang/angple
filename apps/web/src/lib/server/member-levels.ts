/**
 * 회원 레벨 서버사이드 배치 조회 (SSR용)
 *
 * /api/members/levels GET 핸들러의 DB 조회 로직을 공유 모듈로 추출.
 * +page.server.ts에서 SSR 스트리밍으로 직접 호출하여 CDN 요청 제거.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_IDS = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
    level: number;
    expiresAt: number;
};

const levelCache = new Map<string, CacheEntry>();
const inflightBatches = new Map<string, Promise<Record<string, number>>>();

function normalizeIds(ids: string[]): string[] {
    return [...new Set(ids.filter((id) => id && /^[a-zA-Z0-9_-]+$/.test(id)).slice(0, MAX_IDS))];
}

async function queryMemberLevels(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, IFNULL(as_level, 1) as as_level FROM g5_member WHERE mb_id IN (${placeholders})`,
        ids
    );

    const levels: Record<string, number> = {};
    for (const row of rows) {
        levels[row.mb_id] = row.as_level;
    }

    const expiresAt = Date.now() + CACHE_TTL_MS;
    for (const [mbId, level] of Object.entries(levels)) {
        levelCache.set(mbId, { level, expiresAt });
    }

    return levels;
}

/**
 * 회원 레벨(as_level) 배치 조회
 * @param ids mb_id 배열
 * @returns { [mb_id]: as_level } 맵
 */
export async function fetchMemberLevels(ids: string[]): Promise<Record<string, number>> {
    const validIds = normalizeIds(ids);

    if (validIds.length === 0) return {};

    const levels: Record<string, number> = {};
    const missingIds: string[] = [];
    const now = Date.now();

    for (const id of validIds) {
        const cached = levelCache.get(id);
        if (cached && cached.expiresAt > now) {
            levels[id] = cached.level;
            continue;
        }
        missingIds.push(id);
    }

    if (missingIds.length > 0) {
        const batchKey = [...missingIds].sort().join(',');
        let pending = inflightBatches.get(batchKey);
        if (!pending) {
            pending = queryMemberLevels(missingIds).finally(() => {
                inflightBatches.delete(batchKey);
            });
            inflightBatches.set(batchKey, pending);
        }

        Object.assign(levels, await pending);
    }

    return levels;
}

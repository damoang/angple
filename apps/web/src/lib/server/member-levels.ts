/**
 * 회원 레벨 서버사이드 배치 조회 (SSR용)
 *
 * /api/members/levels GET 핸들러의 DB 조회 로직을 공유 모듈로 추출.
 * +page.server.ts에서 SSR 스트리밍으로 직접 호출하여 CDN 요청 제거.
 *
 * #12046 — DB 의 as_level 컬럼이 as_exp 변동을 따라가지 못해 stale 한 케이스가 다수
 * 존재(시스템 광역). 단일 source of truth 인 as_exp + LEVEL_THRESHOLDS 로 항상
 * 동적 계산해 LevelBadge / 프로필 등 모든 표시 위치가 일관된 값을 보도록 함.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { calculateLevelFromExp } from '$lib/utils/level-thresholds';

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
    // #12046 — as_level 컬럼은 stale 가능성이 있어 as_exp 도 함께 조회 후
    // calculateLevelFromExp 로 항상 동적 계산. as_exp 가 없거나 0 이면 폴백 1.
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, IFNULL(as_level, 1) as as_level, IFNULL(as_exp, 0) as as_exp
         FROM g5_member WHERE mb_id IN (${placeholders})`,
        ids
    );

    const levels: Record<string, number> = {};
    for (const row of rows) {
        const exp = Number(row.as_exp) || 0;
        const calculated = calculateLevelFromExp(exp);
        // 저장된 as_level 보다 계산값이 더 크면 계산값(최신) 우선.
        // 두 값 중 큰 쪽을 채택해 backward compat 유지하고 drift 만 보정.
        levels[row.mb_id] = Math.max(calculated, Number(row.as_level) || 1);
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

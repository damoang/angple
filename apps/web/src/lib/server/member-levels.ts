/**
 * 회원 레벨 서버사이드 배치 조회 (SSR용)
 *
 * /api/members/levels GET 핸들러의 DB 조회 로직을 공유 모듈로 추출.
 * +page.server.ts에서 SSR 스트리밍으로 직접 호출하여 CDN 요청 제거.
 *
 * #12046 — DB 의 as_level 컬럼이 as_exp 변동을 따라가지 못해 stale 한 케이스가 다수
 * 존재(시스템 광역). 단일 source of truth 인 as_exp 로 항상 동적 계산해
 * LevelBadge / 프로필 등 모든 표시 위치가 일관된 값을 보도록 함.
 *
 * bug/13149 (2026-07-29) — 그 "동적 계산"이 백엔드와 다른 곡선이었다는 것이 드러나
 * 계산 함수를 백엔드와 같은 2차식으로 교체했다($lib/utils/level-thresholds).
 * 동시에 여기 있던 Math.max(계산값, 저장값) 래칫도 제거했다 — 아래 참조.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { calculateLevelFromExp } from '$lib/utils/level-thresholds';

const MAX_IDS = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;
const LEVEL_CACHE_MAX = 5_000; // mbId 별 entry — 회원수 증가 시 누수 방지

type CacheEntry = {
    level: number;
    expiresAt: number;
};

const levelCache = new Map<string, CacheEntry>();
const inflightBatches = new Map<string, Promise<Record<string, number>>>();

function evictLevelCacheIfFull(): void {
    if (levelCache.size < LEVEL_CACHE_MAX) return;
    const targetSize = Math.floor(LEVEL_CACHE_MAX / 2);
    let toDrop = levelCache.size - targetSize;
    for (const k of levelCache.keys()) {
        if (toDrop-- <= 0) break;
        levelCache.delete(k);
    }
}

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
        // ⛔ 예전에는 Math.max(계산값, 저장값) 이었다. 계산 곡선이 백엔드와 달랐을 때
        //    저장값을 보정해주려던 장치인데, 그 자체가 **제5의 규칙**이 되어
        //    "내 프로필의 레벨"과 "내 댓글 옆 배지"가 서로 다르게 굳는 원인이었다.
        //    2026-07-29 부터 계산 곡선이 백엔드와 동일해졌으므로(bug/13149) 불필요하다.
        //    남겨두면 옛 부풀려진 저장값이 배지에 영구 고착된다.
        levels[row.mb_id] = calculateLevelFromExp(exp);
    }

    const expiresAt = Date.now() + CACHE_TTL_MS;
    for (const [mbId, level] of Object.entries(levels)) {
        evictLevelCacheIfFull();
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

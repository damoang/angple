/**
 * g5_scrap 테이블 CRUD
 * 레거시 PHP와 동일 데이터 공유
 *
 * 캐싱 전략:
 *   isScraped — TieredCache (L1 30s, L2 120s)  ← 게시글 상세 매 조회
 *   getScraps — TieredCache (L1 30s, L2 60s)   ← /my/scraps 페이지
 *   검색 시 캐시 미사용 (검색어별 캐시 키 폭발 방지)
 *   add/remove 시 해당 유저 캐시 무효화
 */
import { readPool, pool } from '$lib/server/db.js';
import { TieredCache } from '$lib/server/cache.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface ScrapRow extends RowDataPacket {
    ms_id: number;
    mb_id: string;
    bo_table: string;
    wr_id: string;
    ms_datetime: string;
}

interface CountRow extends RowDataPacket {
    cnt: number;
}

interface WriteRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    wr_name: string;
}

export interface ScrapItem {
    ms_id: number;
    mb_id: string;
    bo_table: string;
    wr_id: string;
    ms_datetime: string;
    wr_subject?: string;
    wr_name?: string;
}

export interface ScrapListResult {
    items: ScrapItem[];
    total: number;
    page: number;
    totalPages: number;
}

const SAFE_TABLE_RE = /^[a-zA-Z0-9_]+$/;

// isScraped: 게시글 상세 조회마다 호출 → 캐시 필수
const scrapStatusCache = new TieredCache<boolean>('scrap:st', 30_000, 120, 20_000);

// getScraps: /my/scraps 페이지 (검색 없을 때만 캐시)
const scrapListCache = new TieredCache<ScrapListResult>('scrap:ls', 30_000, 60, 2_000);

function statusKey(mbId: string, boTable: string, wrId: string): string {
    return `${mbId}:${boTable}:${wrId}`;
}

function listKey(mbId: string, page: number, limit: number): string {
    return `${mbId}:${page}:${limit}`;
}

/** add/remove 후 해당 유저 캐시 무효화 */
async function invalidateUserCache(mbId: string, boTable: string, wrId: string): Promise<void> {
    await scrapStatusCache.delete(statusKey(mbId, boTable, wrId));
    await scrapListCache.delete(listKey(mbId, 1, 20));
}

/** 스크랩 row → ScrapItem 변환 (제목 일괄 조회 포함) */
async function enrichScraps(rows: ScrapRow[]): Promise<ScrapItem[]> {
    if (rows.length === 0) return [];

    const groups = new Map<string, string[]>();
    for (const row of rows) {
        if (!SAFE_TABLE_RE.test(row.bo_table)) continue;
        const ids = groups.get(row.bo_table) || [];
        ids.push(row.wr_id);
        groups.set(row.bo_table, ids);
    }

    const titleMap = new Map<string, WriteRow>();
    await Promise.all(
        Array.from(groups.entries()).map(([boTable, wrIds]) =>
            readPool
                .query<WriteRow[]>(
                    `SELECT wr_id, wr_subject, wr_name FROM g5_write_${boTable} WHERE wr_id IN (?)`,
                    [wrIds]
                )
                .then(([writeRows]) => {
                    for (const wr of writeRows) {
                        titleMap.set(`${boTable}:${wr.wr_id}`, wr);
                    }
                })
                .catch(() => {})
        )
    );

    return rows.map((row) => {
        const wr = titleMap.get(`${row.bo_table}:${row.wr_id}`);
        return {
            ms_id: row.ms_id,
            mb_id: row.mb_id,
            bo_table: row.bo_table,
            wr_id: row.wr_id,
            ms_datetime: row.ms_datetime,
            wr_subject: wr?.wr_subject,
            wr_name: wr?.wr_name
        };
    });
}

/** 스크랩 목록 조회 (검색 없음 → 캐시) */
export async function getScraps(
    mbId: string,
    page: number,
    limit: number,
    query?: string
): Promise<ScrapListResult> {
    // 검색어가 있으면 캐시 우회
    if (query) {
        return searchScraps(mbId, page, limit, query);
    }

    return scrapListCache.getOrFetch(listKey(mbId, page, limit), () =>
        fetchScrapList(mbId, page, limit)
    );
}

/** 캐시 없이 스크랩 목록 DB 조회 */
async function fetchScrapList(mbId: string, page: number, limit: number): Promise<ScrapListResult> {
    const offset = (page - 1) * limit;

    const [[countRows], [rows]] = await Promise.all([
        readPool.query<CountRow[]>('SELECT COUNT(*) AS cnt FROM g5_scrap WHERE mb_id = ?', [mbId]),
        readPool.query<ScrapRow[]>(
            'SELECT * FROM g5_scrap WHERE mb_id = ? ORDER BY ms_id DESC LIMIT ?, ?',
            [mbId, offset, limit]
        )
    ]);

    const total = countRows[0]?.cnt ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = await enrichScraps(rows);

    return { items, total, page, totalPages };
}

/**
 * 검색: 유저의 모든 스크랩에서 제목 LIKE 필터
 *
 * 전략: 유저별 스크랩은 수백~천 건 수준이므로
 * 1) g5_scrap에서 전체 스크랩 조회 (최대 5000건 제한)
 * 2) bo_table별 그룹 → wr_subject LIKE '%검색어%' 필터
 * 3) 매칭된 ms_id 기준으로 페이지네이션
 */
async function searchScraps(
    mbId: string,
    page: number,
    limit: number,
    query: string
): Promise<ScrapListResult> {
    // 1) 유저의 전체 스크랩 (최대 5000건, 최신순)
    const [allScraps] = await readPool.query<ScrapRow[]>(
        'SELECT * FROM g5_scrap WHERE mb_id = ? ORDER BY ms_id DESC LIMIT 5000',
        [mbId]
    );

    if (allScraps.length === 0) {
        return { items: [], total: 0, page, totalPages: 1 };
    }

    // 2) bo_table별 그룹핑 → 제목 LIKE 검색
    const groups = new Map<string, ScrapRow[]>();
    for (const row of allScraps) {
        if (!SAFE_TABLE_RE.test(row.bo_table)) continue;
        const arr = groups.get(row.bo_table) || [];
        arr.push(row);
        groups.set(row.bo_table, arr);
    }

    const matchedMsIds = new Set<number>();
    const likePattern = `%${query}%`;

    await Promise.all(
        Array.from(groups.entries()).map(async ([boTable, scraps]) => {
            const wrIds = scraps.map((s) => s.wr_id);
            try {
                const [writeRows] = await readPool.query<WriteRow[]>(
                    `SELECT wr_id FROM g5_write_${boTable} WHERE wr_id IN (?) AND wr_subject LIKE ?`,
                    [wrIds, likePattern]
                );
                const matchedWrIds = new Set(writeRows.map((w) => String(w.wr_id)));
                for (const s of scraps) {
                    if (matchedWrIds.has(s.wr_id)) {
                        matchedMsIds.add(s.ms_id);
                    }
                }
            } catch {
                // 테이블 없으면 무시
            }
        })
    );

    // 3) 매칭된 스크랩만 필터 + 페이지네이션
    const matchedScraps = allScraps.filter((s) => matchedMsIds.has(s.ms_id));
    const total = matchedScraps.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const pageRows = matchedScraps.slice(offset, offset + limit) as ScrapRow[];
    const items = await enrichScraps(pageRows);

    return { items, total, page, totalPages };
}

/** 스크랩 추가 (중복 체크) */
export async function addScrap(mbId: string, boTable: string, wrId: string): Promise<boolean> {
    if (!SAFE_TABLE_RE.test(boTable)) return false;

    const [existing] = await readPool.query<ScrapRow[]>(
        'SELECT ms_id FROM g5_scrap WHERE mb_id = ? AND bo_table = ? AND wr_id = ?',
        [mbId, boTable, wrId]
    );
    if (existing.length > 0) return false;

    await pool.query<ResultSetHeader>(
        'INSERT INTO g5_scrap (mb_id, bo_table, wr_id, ms_datetime) VALUES (?, ?, ?, NOW())',
        [mbId, boTable, wrId]
    );

    await invalidateUserCache(mbId, boTable, wrId);
    return true;
}

/** 스크랩 삭제 */
export async function removeScrap(mbId: string, boTable: string, wrId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM g5_scrap WHERE mb_id = ? AND bo_table = ? AND wr_id = ?',
        [mbId, boTable, wrId]
    );

    if (result.affectedRows > 0) {
        await invalidateUserCache(mbId, boTable, wrId);
        return true;
    }
    return false;
}

/** 스크랩 여부 확인 (캐시 우선) */
export async function isScraped(mbId: string, boTable: string, wrId: string): Promise<boolean> {
    return scrapStatusCache.getOrFetch(statusKey(mbId, boTable, wrId), async () => {
        const [rows] = await readPool.query<ScrapRow[]>(
            'SELECT ms_id FROM g5_scrap WHERE mb_id = ? AND bo_table = ? AND wr_id = ? LIMIT 1',
            [mbId, boTable, wrId]
        );
        return rows.length > 0;
    });
}

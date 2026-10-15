/**
 * 삭제 예약 게시글 서버사이드 배치 조회 (SSR용)
 *
 * g5_scheduled_deletes 테이블에서 pending 상태 레코드만 조회해
 * (wr_id → scheduled_at) 매핑을 반환한다. 목록에서 "삭제예정" 뱃지
 * 표시에 사용.
 *
 * 삭제 대기 목록은 보통 비어 있거나 아주 적으므로, 목록 SSR 마다 조회하지 않고
 * 대기 목록 전체를 짧게(SCHEDULED_SET_TTL_MS) 프로세스 캐시에 들고 그 안에서 고른다.
 * 한계: 삭제 예약·취소·실행이 목록 배지에 최대 TTL 만큼 늦게 반영된다.
 * 대기 목록 로드가 실패하거나 늦으면(오류는 캐시하지 않음) 기존처럼 게시판·id 로 직접 조회한다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db.js';
import { createCache } from '$lib/server/cache.js';

const MAX_IDS = 500;

interface ScheduledRow extends RowDataPacket {
    wr_id: number;
    scheduled_at: string;
}

interface PendingRow extends RowDataPacket {
    bo_table: string;
    wr_id: number;
    scheduled_at: string;
}

/** 게시판(소문자) → (wr_id → scheduled_at 원본 값) */
type PendingSet = Map<string, Map<number, unknown>>;

export const SCHEDULED_SET_TTL_MS = 20_000;
export const SCHEDULED_SET_LOAD_TIMEOUT_MS = 1_500;

export const PENDING_SET_SQL = `SELECT bo_table, wr_id, scheduled_at FROM g5_scheduled_deletes
         WHERE status = 'pending' AND wr_is_comment = 0`;

let pendingSetCache = createCache<PendingSet>({ ttl: SCHEDULED_SET_TTL_MS, maxSize: 1 });
const PENDING_SET_KEY = 'all';

// bo_table 비교는 DB 정렬 규칙처럼 대소문자를 가리지 않게 맞춘다.
function boardKey(boTable: string): string {
    return boTable.toLowerCase();
}

// 로드가 끝나지 않으면 singleflight 가 계속 그 약속을 돌려주므로 따로 끊는다(오류 → 미캐시).
async function loadPendingSet(): Promise<PendingSet> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const query = pool.query<PendingRow[]>(PENDING_SET_SQL).then(([rows]) => {
        const set: PendingSet = new Map();
        for (const row of rows) {
            const val = row.scheduled_at;
            if (!val) continue;
            const key = boardKey(String(row.bo_table));
            let board = set.get(key);
            if (!board) {
                board = new Map();
                set.set(key, board);
            }
            board.set(Number(row.wr_id), val);
        }
        return set;
    });
    query.catch(() => {});
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error('scheduled delete set load timeout')),
            SCHEDULED_SET_LOAD_TIMEOUT_MS
        );
    });
    try {
        return await Promise.race([query, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** 기존 직접 조회 (대기 목록 로드 실패 시 폴백) */
async function queryScheduledDeletes(
    safeBoardId: string,
    validIds: number[]
): Promise<Map<number, string>> {
    const placeholders = validIds.map(() => '?').join(',');
    const [rows] = await pool.query<ScheduledRow[]>(
        `SELECT wr_id, scheduled_at FROM g5_scheduled_deletes
         WHERE bo_table = ? AND wr_id IN (${placeholders})
           AND wr_is_comment = 0 AND status = 'pending'`,
        [safeBoardId, ...validIds]
    );

    const result = new Map<number, string>();
    for (const row of rows) {
        const val = row.scheduled_at;
        if (val) result.set(Number(row.wr_id), String(val));
    }
    return result;
}

/**
 * @param boardId bo_table 값
 * @param postIds wr_id 숫자 배열
 * @returns Map<wr_id, scheduled_at ISO string>
 */
export async function fetchScheduledDeletes(
    boardId: string,
    postIds: number[]
): Promise<Map<number, string>> {
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const validIds = postIds.filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_IDS);

    if (!safeBoardId || validIds.length === 0) return new Map();

    let set: PendingSet;
    try {
        set = await pendingSetCache.getOrSet(PENDING_SET_KEY, loadPendingSet);
    } catch {
        return queryScheduledDeletes(safeBoardId, validIds);
    }

    const result = new Map<number, string>();
    const board = set.get(boardKey(safeBoardId));
    if (!board) return result;
    for (const id of validIds) {
        const val = board.get(id);
        if (val) result.set(id, String(val));
    }
    return result;
}

/** 테스트용: 대기 목록 캐시(진행 중 로드 포함)를 새로 만든다. */
export function clearScheduledDeleteCacheForTest(): void {
    pendingSetCache = createCache<PendingSet>({ ttl: SCHEDULED_SET_TTL_MS, maxSize: 1 });
}

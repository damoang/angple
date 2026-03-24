/**
 * 게시판 정보 공유 캐시 모듈
 *
 * [boardId]/+page.server.ts, [boardId]/[postId]/+page.server.ts 에서 공유.
 * board 정보는 관리자 변경 시만 바뀌므로 300초 TTL.
 */
import type { Board } from '$lib/api/types.js';
import { backendFetch as bFetch } from '$lib/server/backend-fetch.js';
import { createCache } from '$lib/server/cache.js';
import { safeJson } from '$lib/api/safe-json.js';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';

const boardInfoCache = createCache<Board>({ ttl: 300_000, maxSize: 200 });
const boardAliasCache = createCache<string>({ ttl: 300_000, maxSize: 400 });

export interface BoardResult {
    board: Board | null;
    /** 백엔드 응답 상태 코드 (캐시 히트 시 200) */
    status: number;
}

/**
 * 게시판 정보 조회 (캐시 우선)
 * board + display_settings 를 병합하여 반환
 */
/**
 * 보드 캐시 무효화 (관리자가 설정 변경 후 즉시 반영용)
 */
export function invalidateBoardCache(boardId: string): void {
    boardInfoCache.delete(boardId);
    boardAliasCache.delete(boardId.toLowerCase());
}

interface BoardAliasRow extends RowDataPacket {
    bo_table: string;
}

export async function resolveCanonicalBoardId(boardId: string): Promise<string> {
    const sanitizedBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitizedBoardId) {
        return boardId;
    }

    const cacheKey = sanitizedBoardId.toLowerCase();
    const cached = boardAliasCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const [rows] = await readPool.query<BoardAliasRow[]>(
        `SELECT bo_table
           FROM g5_board
          WHERE LOWER(bo_table) = LOWER(?)
          LIMIT 1`,
        [sanitizedBoardId]
    );

    const canonicalBoardId = rows[0]?.bo_table || sanitizedBoardId;
    boardAliasCache.set(cacheKey, canonicalBoardId);

    return canonicalBoardId;
}

export async function getCachedBoard(
    boardId: string,
    headers: Record<string, string>
): Promise<BoardResult> {
    const canonicalBoardId = await resolveCanonicalBoardId(boardId);
    const isAuthenticated = Boolean(headers.Authorization);
    const freshCached = boardInfoCache.get(canonicalBoardId);
    if (!isAuthenticated && freshCached) {
        return { board: freshCached, status: 200 };
    }

    const staleCached = boardInfoCache.getStale(canonicalBoardId);

    let boardRes: Response;
    let displaySettingsRes: Response | null = null;

    try {
        [boardRes, displaySettingsRes] = await Promise.all([
            bFetch(`/api/v1/boards/${canonicalBoardId}`, {
                headers,
                timeout: 3_000,
                bypassCircuitBreaker: true
            }),
            bFetch(`/api/v1/boards/${canonicalBoardId}/display-settings`, {
                headers,
                timeout: 3_000,
                bypassCircuitBreaker: true
            })
        ]);
    } catch (error) {
        if (staleCached) {
            console.warn('[board-cache] stale board cache fallback:', canonicalBoardId, error);
            return { board: staleCached, status: 200 };
        }
        throw error;
    }

    if (!boardRes.ok) {
        if (staleCached && boardRes.status >= 500) {
            console.warn(
                '[board-cache] stale board cache fallback on backend error:',
                canonicalBoardId,
                boardRes.status
            );
            return { board: staleCached, status: 200 };
        }
        return { board: null, status: boardRes.status };
    }

    let board: Board | null = (await safeJson<{ data: Board }>(boardRes)).data;

    if (board && displaySettingsRes?.ok) {
        const displaySettings = (
            await safeJson<{ data: Board['display_settings'] }>(displaySettingsRes)
        ).data;
        board = { ...board, display_settings: displaySettings };
    } else if (board && staleCached?.display_settings) {
        board = { ...board, display_settings: staleCached.display_settings };
    }

    if (board) {
        boardInfoCache.set(canonicalBoardId, board);
    }

    return { board, status: boardRes.status };
}

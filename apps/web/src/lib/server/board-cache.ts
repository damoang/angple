/**
 * 게시판 정보 공유 캐시 모듈
 *
 * [boardId]/+page.server.ts, [boardId]/[postId]/+page.server.ts 에서 공유.
 * board 정보는 관리자 변경 시만 바뀌므로 300초 TTL.
 */
import type { Board } from '$lib/api/types.js';
import { backendFetch as bFetch } from '$lib/server/backend-fetch.js';
import { createCache } from '$lib/server/cache.js';

const boardInfoCache = createCache<Board>({ ttl: 300_000, maxSize: 200 });

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
}

export async function getCachedBoard(
    boardId: string,
    headers: Record<string, string>
): Promise<BoardResult> {
    const cached = boardInfoCache.get(boardId);
    if (cached) return { board: cached, status: 200 };

    const [boardRes, displaySettingsRes] = await Promise.all([
        bFetch(`/api/v1/boards/${boardId}`, { headers, timeout: 3_000 }),
        bFetch(`/api/v1/boards/${boardId}/display-settings`, { headers, timeout: 3_000 })
    ]);

    if (!boardRes.ok) {
        return { board: null, status: boardRes.status };
    }

    let board: Board | null = (await boardRes.json()).data as Board;

    if (board && displaySettingsRes.ok) {
        const displaySettings = (await displaySettingsRes.json()).data;
        board = { ...board, display_settings: displaySettings };
    }

    if (board) {
        boardInfoCache.set(boardId, board);
    }

    return { board, status: boardRes.status };
}

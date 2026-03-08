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

/**
 * 게시판 정보 조회 (캐시 우선)
 * board + display_settings 를 병합하여 반환
 */
export async function getCachedBoard(
    boardId: string,
    headers: Record<string, string>
): Promise<Board | null> {
    const cached = boardInfoCache.get(boardId);
    if (cached) return cached;

    const [boardRes, displaySettingsRes] = await Promise.all([
        bFetch(`/api/v1/boards/${boardId}`, { headers, timeout: 3_000 }),
        bFetch(`/api/v1/boards/${boardId}/display-settings`, { headers, timeout: 3_000 })
    ]);

    let board: Board | null = boardRes.ok ? ((await boardRes.json()).data as Board) : null;

    if (board && displaySettingsRes.ok) {
        const displaySettings = (await displaySettingsRes.json()).data;
        board = { ...board, display_settings: displaySettings };
    }

    if (board) {
        boardInfoCache.set(boardId, board);
    }

    return board;
}

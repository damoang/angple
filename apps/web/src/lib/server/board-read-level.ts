/**
 * 게시판 읽기 레벨(g5_board.bo_read_level) 판정.
 *
 * /api/boards/{boardId}/** 라우트는 g5_write_* 를 직접 읽는다. 라우트마다 읽기 레벨을
 * 확인하면 새 라우트를 만들 때 빠뜨리기 쉬워서, hooks 에서 경로 접두사로 한 번에 막는다.
 *
 * - 게시판 전체(수백 행)의 읽기 레벨을 한 번에 읽어 메모리에 둔다(TTL 60초).
 *   요청마다 DB 를 조회하지 않는다.
 * - 새로 읽기에 실패하면 직전 값을 계속 쓴다. 직전 값도 없으면 예외를 던진다
 *   → 호출부는 거부한다(fail-closed).
 * - 그누보드 규약: 비회원 = 레벨 1. bo_read_level 1 = 누구나 읽기.
 */
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';

const TTL_MS = 60_000;

interface ReadLevelRow extends RowDataPacket {
    bo_table: string;
    bo_read_level: number;
}

type ReadLevelMap = Map<string, number>;

let cached: { levels: ReadLevelMap; loadedAt: number } | null = null;
let inflight: Promise<ReadLevelMap> | null = null;

/** 테스트 전용: 캐시와 진행 중 조회를 비운다. */
export function resetBoardReadLevelCache(): void {
    cached = null;
    inflight = null;
}

async function loadReadLevels(): Promise<ReadLevelMap> {
    const [rows] = await readPool.query<ReadLevelRow[]>(
        'SELECT bo_table, bo_read_level FROM g5_board'
    );
    if (!rows || rows.length === 0) {
        // 게시판이 정상적으로 0개일 수는 없다 — 결과가 아니라 조회 이상이다.
        throw new Error('board read levels: empty board list');
    }
    const levels: ReadLevelMap = new Map();
    for (const row of rows) {
        levels.set(String(row.bo_table).toLowerCase(), Number(row.bo_read_level) || 1);
    }
    return levels;
}

async function getReadLevels(): Promise<ReadLevelMap> {
    if (cached && Date.now() - cached.loadedAt < TTL_MS) {
        return cached.levels;
    }
    if (!inflight) {
        inflight = loadReadLevels()
            .then((levels) => {
                cached = { levels, loadedAt: Date.now() };
                return levels;
            })
            .finally(() => {
                inflight = null;
            });
    }
    try {
        return await inflight;
    } catch (error) {
        if (cached) {
            console.warn('[board-read-level] reload failed, using previous levels:', error);
            return cached.levels;
        }
        throw error;
    }
}

export type BoardReadDecision = 'allow' | 'deny' | 'not_found';

/**
 * userLevel(mb_level, 비회원은 1)이 게시판 읽기 레벨 이상이면 'allow'.
 * 게시판이 없으면 'not_found'. 레벨을 알 수 없으면 예외(호출부가 거부).
 */
export async function checkBoardReadAccess(
    boardId: string,
    userLevel: number
): Promise<BoardReadDecision> {
    const levels = await getReadLevels();
    const required = levels.get(boardId.toLowerCase());
    if (required === undefined) return 'not_found';
    return userLevel >= required ? 'allow' : 'deny';
}

/**
 * 접두사 가드용 경로. SvelteKit 은 라우트를 퍼센트 디코딩한 경로로 찾으므로
 * 가드도 라우트 매칭과 같은 기준으로 판정한다.
 * SvelteKit 의 decode_pathname 과 같게 %25 는 보존한다.
 */
export function decodePathForGuard(pathname: string): string {
    try {
        return pathname.split('%25').map(decodeURI).join('%25');
    } catch {
        return pathname;
    }
}

/**
 * 읽기 레벨 가드 대상이면 boardId 를, 아니면 null 을 돌려준다.
 * 1순위는 SvelteKit 이 실제로 고른 라우트(route.id·params)이고,
 * 라우트가 없을 때(404 등)만 디코딩한 경로로 판정한다.
 */
export function boardIdForReadGuard(
    routeId: string | null | undefined,
    params: Partial<Record<string, string>>,
    pathname: string
): string | null {
    if (routeId === '/api/boards/[boardId]' || routeId?.startsWith('/api/boards/[boardId]/')) {
        return params.boardId ?? '';
    }
    return boardIdFromApiPath(decodePathForGuard(pathname));
}

/** /api/boards/{boardId}/... 경로에서 boardId 를 꺼낸다. 해당 경로가 아니면 null. */
export function boardIdFromApiPath(pathname: string): string | null {
    const match = /^\/api\/boards\/([^/]+)(?:\/|$)/.exec(pathname);
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/db.js', () => ({ readPool: { query } }));

import {
    boardIdFromApiPath,
    checkBoardReadAccess,
    resetBoardReadLevelCache
} from './board-read-level.js';

const BOARDS = [
    { bo_table: 'free', bo_read_level: 1 },
    { bo_table: 'claim', bo_read_level: 2 },
    { bo_table: 'monitoring', bo_read_level: 4 },
    { bo_table: 'governance', bo_read_level: 10 }
];

beforeEach(() => {
    resetBoardReadLevelCache();
    query.mockReset();
    query.mockResolvedValue([BOARDS]);
});

describe('checkBoardReadAccess', () => {
    it('공개 게시판은 비회원(레벨 1)도 읽는다', async () => {
        expect(await checkBoardReadAccess('free', 1)).toBe('allow');
    });

    it('관리자 게시판은 비회원·일반회원을 막고 관리자만 통과시킨다', async () => {
        expect(await checkBoardReadAccess('governance', 1)).toBe('deny');
        expect(await checkBoardReadAccess('governance', 2)).toBe('deny');
        expect(await checkBoardReadAccess('governance', 9)).toBe('deny');
        expect(await checkBoardReadAccess('governance', 10)).toBe('allow');
    });

    it('레벨 2 게시판은 비회원을 막고 회원은 통과시킨다', async () => {
        expect(await checkBoardReadAccess('claim', 1)).toBe('deny');
        expect(await checkBoardReadAccess('claim', 2)).toBe('allow');
    });

    it('게시판 이름은 대소문자를 구분하지 않는다', async () => {
        expect(await checkBoardReadAccess('Governance', 1)).toBe('deny');
        expect(await checkBoardReadAccess('FREE', 1)).toBe('allow');
    });

    it('없는 게시판은 not_found', async () => {
        expect(await checkBoardReadAccess('nope', 10)).toBe('not_found');
    });

    it('레벨 목록은 TTL 동안 한 번만 읽는다', async () => {
        await checkBoardReadAccess('free', 1);
        await checkBoardReadAccess('governance', 1);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('처음 조회가 실패하면 예외를 던진다(fail-closed)', async () => {
        query.mockRejectedValueOnce(new Error('db down'));
        await expect(checkBoardReadAccess('free', 1)).rejects.toThrow();
    });

    it('빈 게시판 목록은 조회 이상으로 보고 예외를 던진다', async () => {
        query.mockResolvedValueOnce([[]]);
        await expect(checkBoardReadAccess('free', 1)).rejects.toThrow();
    });

    it('다시 읽기가 실패하면 직전 값을 계속 쓴다', async () => {
        vi.useFakeTimers();
        try {
            expect(await checkBoardReadAccess('governance', 1)).toBe('deny');
            vi.advanceTimersByTime(61_000);
            query.mockRejectedValueOnce(new Error('db down'));
            expect(await checkBoardReadAccess('governance', 1)).toBe('deny');
            expect(await checkBoardReadAccess('free', 1)).toBe('allow');
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('boardIdFromApiPath', () => {
    it('/api/boards/{id}/... 에서 게시판 이름을 꺼낸다', () => {
        expect(boardIdFromApiPath('/api/boards/governance/posts/893/comments')).toBe('governance');
        expect(boardIdFromApiPath('/api/boards/free/posts')).toBe('free');
        expect(boardIdFromApiPath('/api/boards/free')).toBe('free');
    });

    it('다른 경로는 null', () => {
        expect(boardIdFromApiPath('/api/board/free/posts')).toBeNull();
        expect(boardIdFromApiPath('/api/boardsx/free')).toBeNull();
        expect(boardIdFromApiPath('/free/1')).toBeNull();
        expect(boardIdFromApiPath('/api/boards/')).toBeNull();
    });

    it('인코딩된 이름을 풀어서 돌려준다', () => {
        expect(boardIdFromApiPath('/api/boards/Gover%6Eance/posts')).toBe('Governance');
    });
});

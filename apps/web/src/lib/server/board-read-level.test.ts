import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/db.js', () => ({ readPool: { query } }));

import {
    boardIdForReadGuard,
    boardIdFromApiPath,
    checkBoardReadAccess,
    decodePathForGuard,
    resetBoardReadLevelCache
} from './board-read-level.js';

const BOARDS = [
    { bo_table: 'free', bo_read_level: 1 },
    { bo_table: 'members_only', bo_read_level: 2 },
    { bo_table: 'staff_only', bo_read_level: 4 },
    { bo_table: 'admin_only', bo_read_level: 10 }
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
        expect(await checkBoardReadAccess('admin_only', 1)).toBe('deny');
        expect(await checkBoardReadAccess('admin_only', 2)).toBe('deny');
        expect(await checkBoardReadAccess('admin_only', 9)).toBe('deny');
        expect(await checkBoardReadAccess('admin_only', 10)).toBe('allow');
    });

    it('레벨 2 게시판은 비회원을 막고 회원은 통과시킨다', async () => {
        expect(await checkBoardReadAccess('members_only', 1)).toBe('deny');
        expect(await checkBoardReadAccess('members_only', 2)).toBe('allow');
    });

    it('게시판 이름은 대소문자를 구분하지 않는다', async () => {
        expect(await checkBoardReadAccess('Admin_Only', 1)).toBe('deny');
        expect(await checkBoardReadAccess('FREE', 1)).toBe('allow');
    });

    it('없는 게시판은 not_found', async () => {
        expect(await checkBoardReadAccess('nope', 10)).toBe('not_found');
    });

    it('레벨 목록은 TTL 동안 한 번만 읽는다', async () => {
        await checkBoardReadAccess('free', 1);
        await checkBoardReadAccess('admin_only', 1);
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
            expect(await checkBoardReadAccess('admin_only', 1)).toBe('deny');
            vi.advanceTimersByTime(61_000);
            query.mockRejectedValueOnce(new Error('db down'));
            expect(await checkBoardReadAccess('admin_only', 1)).toBe('deny');
            expect(await checkBoardReadAccess('free', 1)).toBe('allow');
            expect(query.mock.calls.length).toBeGreaterThanOrEqual(2);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('boardIdFromApiPath', () => {
    it('/api/boards/{id}/... 에서 게시판 이름을 꺼낸다', () => {
        expect(boardIdFromApiPath('/api/boards/admin_only/posts/1/comments')).toBe('admin_only');
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
        expect(boardIdFromApiPath('/api/boards/Admin%5FOnly/posts')).toBe('Admin_Only');
    });
});

describe('decodePathForGuard', () => {
    it('라우트 매칭과 같은 기준으로 퍼센트 인코딩을 푼다', () => {
        expect(decodePathForGuard('/api/%62oards/x/posts')).toBe('/api/boards/x/posts');
        expect(decodePathForGuard('/api/%61dmin/settings')).toBe('/api/admin/settings');
    });

    it('%25 는 보존하고, 잘못된 인코딩은 원래 경로를 돌려준다', () => {
        expect(decodePathForGuard('/a/%2541')).toBe('/a/%2541');
        expect(decodePathForGuard('/a/%E0%A4%A')).toBe('/a/%E0%A4%A');
    });
});

describe('boardIdForReadGuard', () => {
    it('SvelteKit 이 고른 라우트가 /api/boards/[boardId] 아래면 params.boardId 를 쓴다', () => {
        expect(
            boardIdForReadGuard(
                '/api/boards/[boardId]/posts/[postId]/comments',
                { boardId: 'admin_only', postId: '1' },
                '/api/%62oards/admin_only/posts/1/comments'
            )
        ).toBe('admin_only');
        expect(boardIdForReadGuard('/api/boards/[boardId]', { boardId: 'free' }, '/x')).toBe(
            'free'
        );
    });

    it('라우트가 없으면 디코딩한 경로로 판정한다', () => {
        expect(boardIdForReadGuard(null, {}, '/api/%62oards/admin_only/posts')).toBe('admin_only');
    });

    it('다른 라우트는 null', () => {
        expect(boardIdForReadGuard('/api/feed', {}, '/api/feed')).toBeNull();
        expect(boardIdForReadGuard('/[boardId]/[postId]', { boardId: 'x' }, '/x/1')).toBeNull();
    });
});

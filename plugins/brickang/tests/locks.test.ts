/**
 * locks.test.ts — Phase 2 위치 lock 흐름 단위 테스트.
 *
 * 시나리오:
 *  - acquireLock 성공 → INSERT 호출 + lock 객체 반환
 *  - 동일 좌표 동시 acquireLock → 1명만 성공, 다른 1명 ER_DUP_ENTRY → null
 *  - releaseLock: 본인 lock 만 삭제
 *  - consumeLockInTx: 만료된 lock 은 'lock_expired' 반환 + 행 삭제
 *  - cleanExpiredLocks: DELETE 쿼리 호출
 *
 * mysql2 풀을 mock 으로 대체.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPoolQuery = vi.fn();
const mockReadPoolQuery = vi.fn();
const mockConnQuery = vi.fn();
const mockConnBegin = vi.fn();
const mockConnCommit = vi.fn();
const mockConnRollback = vi.fn();
const mockConnRelease = vi.fn();

vi.mock('../server/db.js', () => ({
    pool: {
        query: (...args: unknown[]) => mockPoolQuery(...args),
        getConnection: vi.fn(async () => ({
            query: (...args: unknown[]) => mockConnQuery(...args),
            beginTransaction: () => mockConnBegin(),
            commit: () => mockConnCommit(),
            rollback: () => mockConnRollback(),
            release: () => mockConnRelease()
        }))
    },
    readPool: {
        query: (...args: unknown[]) => mockReadPoolQuery(...args)
    }
}));

beforeEach(() => {
    mockPoolQuery.mockReset();
    mockReadPoolQuery.mockReset();
    mockConnQuery.mockReset();
    mockConnBegin.mockReset();
    mockConnCommit.mockReset();
    mockConnRollback.mockReset();
    mockConnRelease.mockReset();
});

describe('acquireLock', () => {
    it('성공: INSERT 후 lock 객체 반환', async () => {
        // DELETE expired (no-op), then INSERT success
        mockConnQuery
            .mockResolvedValueOnce([{ affectedRows: 0 }])
            .mockResolvedValueOnce([{ insertId: 42 }]);

        const { acquireLock } = await import('../server/locks.js');
        const lock = await acquireLock(7, 1, { x: 2, y: 3, z: 4 });
        expect(lock).not.toBeNull();
        expect(lock?.id).toBe(42);
        expect(lock?.userId).toBe(7);
        expect(lock?.position).toEqual({ x: 2, y: 3, z: 4 });
        expect(mockConnCommit).toHaveBeenCalledOnce();
    });

    it('UNIQUE 충돌(다른 사용자 점유) → null', async () => {
        mockConnQuery
            .mockResolvedValueOnce([{ affectedRows: 0 }]) // DELETE expired
            .mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' }); // INSERT 충돌

        const { acquireLock } = await import('../server/locks.js');
        const lock = await acquireLock(7, 1, { x: 2, y: 3, z: 4 });
        expect(lock).toBeNull();
        expect(mockConnRollback).toHaveBeenCalledOnce();
    });

    it('만료 lock 사전 정리 후 INSERT', async () => {
        mockConnQuery
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // 만료 lock 1개 삭제
            .mockResolvedValueOnce([{ insertId: 100 }]);

        const { acquireLock } = await import('../server/locks.js');
        const lock = await acquireLock(8, 1, { x: 0, y: 0, z: 0 });
        expect(lock?.id).toBe(100);
    });
});

describe('releaseLock', () => {
    it('본인 lock 삭제 → 1', async () => {
        mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const { releaseLock } = await import('../server/locks.js');
        const n = await releaseLock(7, 42);
        expect(n).toBe(1);
        const sqlArg = mockPoolQuery.mock.calls[0][0] as string;
        expect(sqlArg).toContain('user_id = ?');
    });

    it('다른 사람 lock → 0', async () => {
        mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);
        const { releaseLock } = await import('../server/locks.js');
        const n = await releaseLock(99, 42);
        expect(n).toBe(0);
    });
});

describe('consumeLockInTx', () => {
    it('정상 lock → 행 삭제 + null', async () => {
        const fakeConn = {
            query: vi.fn()
        };
        const future = new Date(Date.now() + 60_000);
        fakeConn.query
            .mockResolvedValueOnce([
                [
                    {
                        id: 1,
                        building_id: 1,
                        position_x: 0,
                        position_y: 0,
                        position_z: 0,
                        user_id: 7,
                        expires_at: future,
                        created_at: new Date()
                    }
                ]
            ])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const { consumeLockInTx } = await import('../server/locks.js');
        const reason = await consumeLockInTx(fakeConn as never, 7, 1);
        expect(reason).toBeNull();
        expect(fakeConn.query).toHaveBeenCalledTimes(2);
    });

    it('lock 없음 → lock_not_found', async () => {
        const fakeConn = { query: vi.fn().mockResolvedValueOnce([[]]) };
        const { consumeLockInTx } = await import('../server/locks.js');
        const reason = await consumeLockInTx(fakeConn as never, 7, 1);
        expect(reason).toBe('lock_not_found');
    });

    it('소유주 불일치 → lock_not_owner', async () => {
        const fakeConn = {
            query: vi.fn().mockResolvedValueOnce([
                [
                    {
                        id: 1,
                        building_id: 1,
                        position_x: 0,
                        position_y: 0,
                        position_z: 0,
                        user_id: 99,
                        expires_at: new Date(Date.now() + 60_000),
                        created_at: new Date()
                    }
                ]
            ])
        };
        const { consumeLockInTx } = await import('../server/locks.js');
        const reason = await consumeLockInTx(fakeConn as never, 7, 1);
        expect(reason).toBe('lock_not_owner');
    });

    it('만료 lock → lock_expired + 행 삭제', async () => {
        const past = new Date(Date.now() - 60_000);
        const fakeConn = { query: vi.fn() };
        fakeConn.query
            .mockResolvedValueOnce([
                [
                    {
                        id: 1,
                        building_id: 1,
                        position_x: 0,
                        position_y: 0,
                        position_z: 0,
                        user_id: 7,
                        expires_at: past,
                        created_at: new Date()
                    }
                ]
            ])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        const { consumeLockInTx } = await import('../server/locks.js');
        const reason = await consumeLockInTx(fakeConn as never, 7, 1);
        expect(reason).toBe('lock_expired');
        expect(fakeConn.query).toHaveBeenCalledTimes(2);
    });
});

describe('cleanExpiredLocks', () => {
    it('DELETE 쿼리 실행 → affectedRows 반환', async () => {
        mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 5 }]);
        const { cleanExpiredLocks } = await import('../server/locks.js');
        const n = await cleanExpiredLocks(100);
        expect(n).toBe(5);
        const sql = mockPoolQuery.mock.calls[0][0] as string;
        expect(sql).toContain('expires_at < NOW(6)');
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, redisSetex } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    redisSetex: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery },
    readPool: { query: mockQuery }
}));

vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({ get: vi.fn(), setex: redisSetex })
}));

import { UPSERT_SQL, putMemberUiSettings } from './ui-settings-store';

/** 공백을 한 칸으로 줄여 SQL 구조만 비교 */
function squash(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
}

describe('UPSERT_SQL', () => {
    it('settings 가 같으면 updated_at 을 유지한다', () => {
        expect(squash(UPSERT_SQL)).toContain(
            'updated_at = IF(settings <=> CAST(VALUES(settings) AS JSON), updated_at, NOW())'
        );
    });

    it('updated_at 비교가 settings 덮어쓰기보다 먼저 온다 (왼쪽부터 적용)', () => {
        const sql = squash(UPSERT_SQL);
        const updatedAtPos = sql.indexOf('updated_at = IF(');
        const settingsPos = sql.indexOf('settings = VALUES(settings)');
        expect(updatedAtPos).toBeGreaterThan(-1);
        expect(settingsPos).toBeGreaterThan(-1);
        expect(updatedAtPos).toBeLessThan(settingsPos);
    });

    it('updated_at 을 무조건 NOW() 로 덮어쓰지 않는다', () => {
        expect(squash(UPSERT_SQL)).not.toContain('updated_at = NOW()');
    });
});

describe('putMemberUiSettings', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        redisSetex.mockReset();
        mockQuery.mockResolvedValue([{ affectedRows: 1 }]);
        redisSetex.mockResolvedValue('OK');
    });

    it('UPSERT_SQL 로 저장하고 캐시를 갱신한다', async () => {
        const ok = await putMemberUiSettings('user1', { titleBold: true });
        expect(ok).toBe(true);
        expect(mockQuery).toHaveBeenCalledWith(UPSERT_SQL, ['user1', '{"titleBold":true}']);
        expect(redisSetex).toHaveBeenCalledWith('uis:user1', 300, '{"titleBold":true}');
    });

    it('DB 실패 → false, throw 하지 않음', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));
        await expect(putMemberUiSettings('user1', { titleBold: true })).resolves.toBe(false);
    });

    it('mbId 없음 → false', async () => {
        await expect(putMemberUiSettings('', {})).resolves.toBe(false);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

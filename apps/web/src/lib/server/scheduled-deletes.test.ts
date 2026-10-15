import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

type Result = unknown[] | Error | 'hang';

// 대기 목록 쿼리와 직접(폴백) 쿼리를 따로 흉내 낸다.
let setResult: Result = [];
let directResult: Result = [];
const calls: { sql: string; params?: unknown[] }[] = [];

function respond(result: Result) {
    if (result === 'hang') return new Promise(() => {});
    return result instanceof Error ? Promise.reject(result) : Promise.resolve([result]);
}

vi.mock('$lib/server/db.js', () => ({
    default: {
        query: (sql: string, params?: unknown[]) => {
            calls.push({ sql, params });
            return respond(sql.includes('wr_id IN') ? directResult : setResult);
        }
    }
}));

import {
    clearScheduledDeleteCacheForTest,
    fetchScheduledDeletes,
    PENDING_SET_SQL,
    SCHEDULED_SET_LOAD_TIMEOUT_MS,
    SCHEDULED_SET_TTL_MS
} from './scheduled-deletes.js';

const AT = '2026-01-02 03:04:05';
const AT_DATE = new Date('2026-01-02T03:04:05+09:00');

describe('fetchScheduledDeletes', () => {
    beforeEach(() => {
        setResult = [];
        directResult = [];
        calls.length = 0;
        clearScheduledDeleteCacheForTest();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('대기 목록에서 그 게시판·id 만 고른다', async () => {
        setResult = [
            { bo_table: 'free', wr_id: 1, scheduled_at: AT },
            { bo_table: 'free', wr_id: 9, scheduled_at: AT },
            { bo_table: 'qa', wr_id: 2, scheduled_at: AT }
        ];
        const result = await fetchScheduledDeletes('free', [1, 2, 3]);
        expect(result).toEqual(new Map([[1, AT]]));
        expect(calls).toEqual([{ sql: PENDING_SET_SQL, params: undefined }]);
    });

    it('대기 목록 쿼리는 pending·본문 글만 읽는다', () => {
        expect(PENDING_SET_SQL).toContain("status = 'pending'");
        expect(PENDING_SET_SQL).toContain('wr_is_comment = 0');
    });

    it('게시판 비교는 대소문자를 가리지 않는다', async () => {
        setResult = [{ bo_table: 'Free', wr_id: 7, scheduled_at: AT }];
        await expect(fetchScheduledDeletes('free', [7])).resolves.toEqual(new Map([[7, AT]]));
        await expect(fetchScheduledDeletes('FREE', [7])).resolves.toEqual(new Map([[7, AT]]));
    });

    it('반환 형태와 시간 변환이 직접 조회와 같다', async () => {
        const rows = [
            { bo_table: 'free', wr_id: 3, scheduled_at: AT_DATE },
            { bo_table: 'free', wr_id: 4, scheduled_at: AT },
            { bo_table: 'free', wr_id: 5, scheduled_at: null }
        ];
        setResult = rows;
        const fromSet = await fetchScheduledDeletes('free', [3, 4, 5]);

        clearScheduledDeleteCacheForTest();
        setResult = new Error('connection lost');
        directResult = rows.map(({ wr_id, scheduled_at }) => ({ wr_id, scheduled_at }));
        const fromDirect = await fetchScheduledDeletes('free', [3, 4, 5]);

        expect(fromSet).toEqual(fromDirect);
        expect(fromSet.get(3)).toBe(String(AT_DATE));
        expect(fromSet.get(4)).toBe(AT);
        expect(fromSet.has(5)).toBe(false);
    });

    it('대기 목록 로드 실패 → 기존 직접 조회', async () => {
        setResult = new Error('connection lost');
        directResult = [{ wr_id: 1, scheduled_at: AT }];
        await expect(fetchScheduledDeletes('free', [1, 2])).resolves.toEqual(new Map([[1, AT]]));
        expect(calls).toHaveLength(2);
        expect(calls[1].params).toEqual(['free', 1, 2]);
    });

    it('실패는 캐시하지 않는다 — 다음 조회가 다시 읽는다', async () => {
        setResult = new Error('connection lost');
        await fetchScheduledDeletes('free', [1]);
        setResult = [{ bo_table: 'free', wr_id: 1, scheduled_at: AT }];
        await expect(fetchScheduledDeletes('free', [1])).resolves.toEqual(new Map([[1, AT]]));
        expect(calls.filter((c) => c.sql === PENDING_SET_SQL)).toHaveLength(2);
    });

    it('끝나지 않는 로드는 타임아웃 뒤 직접 조회로', async () => {
        vi.useFakeTimers();
        setResult = 'hang';
        directResult = [{ wr_id: 1, scheduled_at: AT }];
        const pending = fetchScheduledDeletes('free', [1]);
        await vi.advanceTimersByTimeAsync(SCHEDULED_SET_LOAD_TIMEOUT_MS);
        await expect(pending).resolves.toEqual(new Map([[1, AT]]));
    });

    it('집합은 TTL 동안 한 번만 읽는다', async () => {
        setResult = [{ bo_table: 'free', wr_id: 1, scheduled_at: AT }];
        await fetchScheduledDeletes('free', [1]);
        await fetchScheduledDeletes('qa', [2]);
        await fetchScheduledDeletes('free', [3]);
        expect(calls).toHaveLength(1);
    });

    it('동시 조회는 쿼리 하나를 나눠 쓴다', async () => {
        setResult = [{ bo_table: 'free', wr_id: 1, scheduled_at: AT }];
        const results = await Promise.all([
            fetchScheduledDeletes('free', [1]),
            fetchScheduledDeletes('free', [2])
        ]);
        expect(results).toEqual([new Map([[1, AT]]), new Map()]);
        expect(calls).toHaveLength(1);
    });

    it('TTL 이 지나면 다시 읽어 새 예약을 반영한다', async () => {
        vi.useFakeTimers();
        setResult = [];
        await expect(fetchScheduledDeletes('free', [1])).resolves.toEqual(new Map());
        setResult = [{ bo_table: 'free', wr_id: 1, scheduled_at: AT }];
        vi.setSystemTime(Date.now() + SCHEDULED_SET_TTL_MS + 1);
        await expect(fetchScheduledDeletes('free', [1])).resolves.toEqual(new Map([[1, AT]]));
        expect(calls).toHaveLength(2);
    });

    it('잘못된 인자는 조회 없이 빈 Map', async () => {
        await expect(fetchScheduledDeletes('', [1])).resolves.toEqual(new Map());
        await expect(fetchScheduledDeletes('free', [0, -1, Number('abc')])).resolves.toEqual(
            new Map()
        );
        expect(calls).toHaveLength(0);
    });
});

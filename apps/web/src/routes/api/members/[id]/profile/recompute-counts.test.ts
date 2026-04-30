import { describe, it, expect, vi } from 'vitest';
import { calculateDeletePostCount, type QueryFn } from './_recompute-counts';

/**
 * mockQuery: g5_board 조회 → 보드 목록 반환, UNION ALL → 보드별 COUNT 반환
 * 호출 순서대로 응답을 큐에서 꺼낸다.
 */
function makeMockQuery(responses: unknown[][]): QueryFn {
    let i = 0;
    return (async (_sql: string, _params?: unknown[]) => {
        const rows = responses[i++] ?? [];
        return [rows, []];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any as QueryFn;
}

describe('calculateDeletePostCount', () => {
    it('보드 합산: 3 + 2 + 0 = 5', async () => {
        const query = makeMockQuery([
            // g5_board → bo_use_search = 1 보드 3개
            [{ bo_table: 'free' }, { bo_table: 'humor' }, { bo_table: 'qa' }],
            // UNION ALL 결과 (각 보드 1 row 씩)
            [{ cnt: 3 }, { cnt: 2 }, { cnt: 0 }]
        ]);
        const result = await calculateDeletePostCount(query, 'testuser');
        expect(result).toBe(5);
    });

    it('보드 0개일 때 0 반환 (UNION 쿼리 호출 안 함)', async () => {
        const calls: string[] = [];
        const query: QueryFn = (async (sql: string) => {
            calls.push(sql);
            if (sql.includes('FROM g5_board')) return [[], []];
            return [[], []];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;
        const result = await calculateDeletePostCount(query, 'testuser');
        expect(result).toBe(0);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain('g5_board');
    });

    it('g5_board 쿼리 실패 시 0 반환 (throw 안 함)', async () => {
        const query: QueryFn = (async () => {
            throw new Error('table not found');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;
        const result = await calculateDeletePostCount(query, 'testuser');
        expect(result).toBe(0);
    });

    it('UNION ALL 쿼리 실패 시 0 반환', async () => {
        let callCount = 0;
        const query: QueryFn = (async (sql: string) => {
            callCount++;
            if (callCount === 1) return [[{ bo_table: 'free' }], []];
            throw new Error('column wr_deleted_at not found');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;
        const result = await calculateDeletePostCount(query, 'testuser');
        expect(result).toBe(0);
    });

    it('bo_table 비정상 값(특수문자) 은 화이트리스트로 제외', async () => {
        const captured: { sql: string; params: unknown[] }[] = [];
        const query: QueryFn = (async (sql: string, params?: unknown[]) => {
            captured.push({ sql, params: params ?? [] });
            if (sql.includes('FROM g5_board')) {
                return [
                    [
                        { bo_table: 'free' },
                        { bo_table: 'evil; DROP TABLE--' }, // 차단 대상
                        { bo_table: 'humor' }
                    ],
                    []
                ];
            }
            return [[{ cnt: 1 }, { cnt: 4 }], []];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        const result = await calculateDeletePostCount(query, 'testuser');
        expect(result).toBe(5);

        // UNION ALL 쿼리에서 evil 보드는 제외되었는지 확인
        const unionCall = captured[1];
        expect(unionCall.sql).toContain('g5_write_free');
        expect(unionCall.sql).toContain('g5_write_humor');
        expect(unionCall.sql).not.toContain('evil');
        // params 는 보드 수와 동일 (각 보드당 mb_id 1번)
        expect(unionCall.params).toEqual(['testuser', 'testuser']);
    });

    it('UNION ALL SQL 에 wr_is_comment = 0 + wr_deleted_at 조건 포함', async () => {
        const captured: string[] = [];
        const query: QueryFn = (async (sql: string) => {
            captured.push(sql);
            if (sql.includes('FROM g5_board')) {
                return [[{ bo_table: 'free' }], []];
            }
            return [[{ cnt: 0 }], []];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        await calculateDeletePostCount(query, 'testuser');
        const unionSql = captured[1];
        expect(unionSql).toContain('wr_is_comment = 0');
        expect(unionSql).toContain('wr_deleted_at IS NOT NULL');
        expect(unionSql).toContain("wr_deleted_at != '0000-00-00 00:00:00'");
    });

    it('cnt 가 string 으로 와도 Number 변환 후 합산', async () => {
        const query = makeMockQuery([
            [{ bo_table: 'free' }, { bo_table: 'humor' }],
            [{ cnt: '7' }, { cnt: '3' }]
        ]);
        const result = await calculateDeletePostCount(query, 'testuser');
        expect(result).toBe(10);
    });
});

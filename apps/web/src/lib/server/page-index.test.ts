import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const redisGet = vi.fn();
const redisSetex = vi.fn();
const redisHgetall = vi.fn();
const redisSet = vi.fn();
const multiExec = vi.fn();
const multiCalls: Array<[string, unknown[]]> = [];

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery },
    pool: { query: mockQuery }
}));

vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({
        get: redisGet,
        setex: redisSetex,
        hgetall: redisHgetall,
        set: redisSet,
        multi: () => {
            const chain: Record<string, unknown> = {};
            for (const name of ['hset', 'expire', 'rename']) {
                chain[name] = (...args: unknown[]) => {
                    multiCalls.push([name, args]);
                    return chain;
                };
            }
            chain.exec = multiExec;
            return chain;
        }
    })
}));

const B = 10_000;

/** 목 게시판: 정상 글 wr_id 목록과 (집계에 안 잡히는) 댓글·삭제 글 최대 id */
let posts: number[] = [];
let maxAnyId = 0;

function countWhere(pred: (id: number) => boolean): number {
    return posts.filter(pred).length;
}

/** SQL 모양으로 어느 쿼리인지 가려 목 데이터로 답한다 */
function installDb() {
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('g5_board ')) return [[{ bo_page_rows: 25 }]];
        if (sql.includes('MAX(wr_id)')) return [[{ m: maxAnyId }]];
        if (sql.includes('GROUP BY')) {
            const [sealed] = params as number[];
            const map = new Map<number, number>();
            for (const id of posts) {
                if (id < sealed) {
                    const k = Math.floor(id / B);
                    map.set(k, (map.get(k) ?? 0) + 1);
                }
            }
            return [[...map].map(([k, c]) => ({ k, c }))];
        }
        if (sql.includes('wr_id < ?') && sql.includes('wr_id >= ?')) {
            const [target, end, sealed] = params as number[];
            const c =
                countWhere((id) => id > target && id < end) + countWhere((id) => id >= sealed);
            return [[{ c }]];
        }
        if (sql.includes('wr_id > ?')) {
            const [target] = params as number[];
            return [[{ c: countWhere((id) => id > target) }]];
        }
        throw new Error('unexpected sql: ' + sql);
    });
}

function sqlCalls(fragment: string) {
    return mockQuery.mock.calls.filter(([sql]) => (sql as string).includes(fragment));
}

/** 범위 서브쿼리 두 개짜리(구간 합계 경로) 호출 */
function rangeCalls() {
    return mockQuery.mock.calls.filter(
        ([sql]) => (sql as string).includes('wr_id < ?') && (sql as string).includes('wr_id >= ?')
    );
}

/** 단일 COUNT(wr_id > ?) 호출 */
function directCalls() {
    return mockQuery.mock.calls.filter(
        ([sql]) =>
            (sql as string).includes('wr_id > ?') &&
            !(sql as string).includes('wr_id < ?') &&
            (sql as string).includes('COUNT(*) AS c')
    );
}

async function loadModule() {
    vi.resetModules();
    return import('./page-index.js');
}

/** 넓게 퍼진 목 데이터: 0~54,999 사이 7의 배수 + 일부 구멍 */
function seedSpread() {
    posts = [];
    for (let id = 7; id < 55_000; id += 7) {
        if (id % 1_000 === 0) continue; // 삭제된 글 흉내
        posts.push(id);
    }
    maxAnyId = 55_123; // 댓글이 더 큰 id 를 가질 수 있다
}

describe('getPageIndex — 구간 합계', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        redisGet.mockReset();
        redisSetex.mockReset();
        redisHgetall.mockReset();
        redisSet.mockReset();
        multiExec.mockReset();
        multiCalls.length = 0;

        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
        redisHgetall.mockResolvedValue({});
        redisSet.mockResolvedValue('OK');
        multiExec.mockResolvedValue([]);
        seedSpread();
        installDb();
    });

    it('(a) 해시가 없고 락을 잡으면 채우기 쿼리 후 합산하고 임시 키→RENAME 으로 저장한다', async () => {
        const { getPageIndex } = await loadModule();
        const target = 12_345;

        const result = await getPageIndex('free', target);

        expect(result.prior).toBe(countWhere((id) => id > target));
        expect(redisSet).toHaveBeenCalledWith('pi:bk:free:lock', '1', 'EX', 30, 'NX');
        expect(sqlCalls('MAX(wr_id)')).toHaveLength(1);
        expect(sqlCalls('GROUP BY')).toHaveLength(1);
        // 봉인 경계 = floor(55123/B)*B - B = 40000
        expect(sqlCalls('GROUP BY')[0][1]).toEqual([40_000]);
        expect(rangeCalls()).toHaveLength(1);
        expect(rangeCalls()[0][1]).toEqual([target, 20_000, 40_000]);
        expect(directCalls()).toHaveLength(0);

        const hsetCall = multiCalls.find(([n]) => n === 'hset');
        const renameCall = multiCalls.find(([n]) => n === 'rename');
        expect(hsetCall?.[1][0]).toMatch(/^pi:bk:free:tmp:/);
        expect((hsetCall?.[1][1] as Record<string, string>).sealed).toBe('40000');
        expect(renameCall?.[1]).toEqual([hsetCall?.[1][0], 'pi:bk:free']);
        expect(multiExec).toHaveBeenCalledTimes(1);
        // per-post 캐시는 그대로 저장된다
        expect(redisSetex).toHaveBeenCalledWith(
            `pi:prior:free:${target}`,
            expect.any(Number),
            String(result.prior)
        );
    });

    it('(b) 해시가 있으면 GROUP BY 없이 범위 COUNT 만 친다', async () => {
        const hash: Record<string, string> = { sealed: '40000' };
        for (let k = 0; k < 4; k++) {
            hash[String(k)] = String(countWhere((id) => id >= k * B && id < (k + 1) * B));
        }
        redisHgetall.mockResolvedValue(hash);
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free', 3_333);

        expect(result.prior).toBe(countWhere((id) => id > 3_333));
        expect(sqlCalls('GROUP BY')).toHaveLength(0);
        expect(sqlCalls('MAX(wr_id)')).toHaveLength(0);
        expect(redisSet).not.toHaveBeenCalled();
        expect(rangeCalls()).toHaveLength(1);
        expect(directCalls()).toHaveLength(0);
    });

    it('(c) target >= 봉인 경계면 단일 범위 COUNT 하나만', async () => {
        redisHgetall.mockResolvedValue({ sealed: '40000', '0': '1', '1': '1' });
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free', 41_000);

        expect(result.prior).toBe(countWhere((id) => id > 41_000));
        expect(directCalls()).toHaveLength(1);
        expect(directCalls()[0][1]).toEqual([41_000]);
        expect(rangeCalls()).toHaveLength(0);
    });

    it('(d-1) 락을 못 잡으면 기존 단일 COUNT 로 간다', async () => {
        redisSet.mockResolvedValue(null);
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free', 12_345);

        expect(result.prior).toBe(countWhere((id) => id > 12_345));
        expect(sqlCalls('MAX(wr_id)')).toHaveLength(0);
        expect(sqlCalls('GROUP BY')).toHaveLength(0);
        expect(directCalls()).toHaveLength(1);
        expect(rangeCalls()).toHaveLength(0);
    });

    it('(d-2) Redis 오류면 기존 단일 COUNT 로 간다', async () => {
        redisGet.mockRejectedValue(new Error('down'));
        redisSetex.mockRejectedValue(new Error('down'));
        redisHgetall.mockRejectedValue(new Error('down'));
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free', 12_345);

        expect(result.prior).toBe(countWhere((id) => id > 12_345));
        expect(result.page).toBe(Math.floor(result.prior / 25) + 1);
        expect(directCalls()).toHaveLength(1);
        expect(rangeCalls()).toHaveLength(0);
    });

    it('(d-3) 해시 형식이 틀리면 채우기를 시도한다', async () => {
        redisHgetall.mockResolvedValue({ sealed: '12345' });
        redisSet.mockResolvedValue(null);
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free', 100);

        expect(result.prior).toBe(countWhere((id) => id > 100));
        expect(redisSet).toHaveBeenCalled();
        expect(directCalls()).toHaveLength(1);
    });

    it('(e) 여러 글에서 구간 합계 결과가 단순 COUNT 와 같다', async () => {
        const { getPageIndex } = await loadModule();
        const first = await getPageIndex('free', 1);
        expect(first.prior).toBe(countWhere((id) => id > 1));

        // 첫 호출이 저장한 해시를 이후 호출이 읽게 한다
        const saved = multiCalls.find(([n]) => n === 'hset')?.[1][1] as Record<string, string>;
        redisHgetall.mockResolvedValue(saved);

        for (const target of [7, 9_996, 10_003, 19_999, 25_550, 39_998, 40_000, 54_999, 60_000]) {
            const r = await getPageIndex('free', target);
            expect(r.prior).toBe(countWhere((id) => id > target));
        }
        expect(sqlCalls('GROUP BY')).toHaveLength(1);
    });

    it('(f) 구간 경계 오프바이원: target = k*B-1, k*B, k*B+1', async () => {
        // 경계 바로 위·아래에 글을 둔다
        posts = [];
        for (let k = 0; k < 6; k++) {
            for (const d of [-1, 0, 1]) {
                const id = k * B + d;
                if (id > 0) posts.push(id);
            }
        }
        posts.sort((a, b) => a - b);
        maxAnyId = 55_001;
        const hash: Record<string, string> = { sealed: '40000' };
        for (let k = 0; k < 4; k++) {
            hash[String(k)] = String(countWhere((id) => id >= k * B && id < (k + 1) * B));
        }
        redisHgetall.mockResolvedValue(hash);
        const { getPageIndex } = await loadModule();

        for (let k = 1; k <= 5; k++) {
            for (const d of [-1, 0, 1]) {
                const target = k * B + d;
                const r = await getPageIndex('free', target);
                expect(r.prior, `target=${target}`).toBe(countWhere((id) => id > target));
            }
        }
    });

    it('per-post 캐시 적중이면 아무 쿼리도 치지 않는다', async () => {
        redisGet.mockImplementation(async (key: string) =>
            key.startsWith('pi:rows:') ? '25' : '77'
        );
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free', 12_345);

        expect(result).toEqual({ page: 4, page_rows: 25, prior: 77 });
        expect(mockQuery).not.toHaveBeenCalled();
        expect(redisHgetall).not.toHaveBeenCalled();
    });

    it('잘못된 게시판 id 는 쿼리 없이 1페이지', async () => {
        const { getPageIndex } = await loadModule();

        const result = await getPageIndex('free;drop', 10);

        expect(result).toEqual({ page: 1, page_rows: 25, prior: 0 });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
